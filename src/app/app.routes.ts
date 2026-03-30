import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'opening',
    loadComponent: () => import('./features/section/section.component').then(m => m.SectionComponent),
    data: { section: 'opening', title: 'Opening the House', icon: '🔓', color: '#4CAF50' }
  },
  {
    path: 'closing',
    loadComponent: () => import('./features/section/section.component').then(m => m.SectionComponent),
    data: { section: 'closing', title: 'Closing the House', icon: '🔒', color: '#2196F3' }
  },
  {
    path: 'tips',
    loadComponent: () => import('./features/section/section.component').then(m => m.SectionComponent),
    data: { section: 'tips', title: 'General Tips', icon: '💡', color: '#FF9800' }
  },
  { path: '**', redirectTo: '' }
];
