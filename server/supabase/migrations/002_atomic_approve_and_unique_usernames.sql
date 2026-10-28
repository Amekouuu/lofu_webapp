-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once. The server works without it (it falls back to the older
-- step-by-step code), but with it claim approval becomes all-or-nothing.

-- 1. Usernames are unique regardless of case ("Maria" and "maria" are the same person).
--    If this fails with "could not create unique index", two existing users differ only by
--    case: rename one of them first.
create unique index if not exists users_username_lower_idx on users (lower(username));

-- 2. Approving a claim as ONE transaction: claim -> post -> other claims -> chat -> first message.
--    If any step fails, none of them are kept (before, a failure halfway left a half-approved post).
create or replace function approve_claim(p_claim_id uuid, p_owner_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim claims%rowtype;
  v_post posts%rowtype;
  v_conversation uuid;
  v_text text;
begin
  -- Lock the claim and its post so two approvals cannot run at the same time.
  select * into v_claim from claims where id = p_claim_id for update;
  if not found then
    raise exception 'claim_not_found' using errcode = 'P0002';
  end if;

  select * into v_post from posts where id = v_claim.post_id for update;
  if not found then
    raise exception 'post_not_found' using errcode = 'P0002';
  end if;

  if v_post.author_id <> p_owner_id then
    raise exception 'not_owner' using errcode = '42501';
  end if;

  if v_post.status = 'Resolved' then
    raise exception 'already_resolved' using errcode = 'P0001';
  end if;

  update claims set status = 'Approved' where id = p_claim_id;
  update claims set status = 'Rejected' where post_id = v_post.id and id <> p_claim_id;
  update posts set status = 'Resolved', approved_claim_id = p_claim_id where id = v_post.id;

  -- Reuse an existing chat between the same two people about this post, otherwise create one.
  select c.id into v_conversation
  from conversations c
  where c.post_id = v_post.id
    and exists (select 1 from conversation_participants p
                where p.conversation_id = c.id and p.user_id = v_post.author_id)
    and exists (select 1 from conversation_participants p
                where p.conversation_id = c.id and p.user_id = v_claim.claimant_id)
  limit 1;

  if v_conversation is null then
    insert into conversations (post_id, claim_id) values (v_post.id, p_claim_id)
    returning id into v_conversation;

    insert into conversation_participants (conversation_id, user_id)
    values (v_conversation, v_post.author_id), (v_conversation, v_claim.claimant_id);
  end if;

  v_text := format(
    E'\U0001F389 Claim approved! "%s" has been matched. Please coordinate here to arrange the return. Good luck! \U0001F91D',
    v_post.item_name
  );

  insert into messages (conversation_id, sender_id, content)
  values (v_conversation, v_post.author_id, v_text);

  update conversations set last_message = v_text, last_message_at = now() where id = v_conversation;

  return v_conversation;
end;
$$;

-- Only the server (service role) may call it; the public API roles may not.
revoke all on function approve_claim(uuid, uuid) from public, anon, authenticated;
grant execute on function approve_claim(uuid, uuid) to service_role;
