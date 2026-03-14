import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  features = [
    {
      title: 'Community & Trust',
      desc: 'Join a network of neighbors dedicated to looking out for one another and their belongings.',
    },
    {
      title: 'Smart Categorization',
      desc: 'Filter by location, date, or item type to find exactly what you\'re looking for in seconds.',
    },
    {
      title: 'Safe Returns',
      desc: 'Coordinate meetups in public spaces through our integrated community map.',
    },
  ];

  highlights = [
    {
      label: 'Lost & Found',
      desc: 'Browse items found in your area.',
      icon: 'search',
    },
    {
      label: 'Verified Proof',
      desc: 'Confirm ownership through photos.',
      icon: 'fingerprint',
    },
    {
      label: 'Safe Meetups',
      desc: 'Connect with neighbors.',
      icon: 'handshake',
    },
  ];
}