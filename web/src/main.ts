import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import './app.css';
import App from './App.svelte';
import './lib/pwa.svelte';
import { store } from './lib/store.svelte';

mount(App, { target: document.getElementById('app')! });
store.init();
registerSW({ immediate: true });
