import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Nav } from '../nav/nav';
import { Footer } from '../footer/footer';

@Component({
  selector: 'app-main-shell',
  imports: [RouterOutlet, Nav, Footer],
  templateUrl: './main-shell.html',
  styleUrl: './main-shell.css',
})
export class MainShell {}