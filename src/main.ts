import { createApp } from 'vue';
import '@xyflow/vue/style.css';
import './styles/base.css';
import { createAppContainer } from '@composition/createAppContainer';
import App from '@ui/App.vue';
import { APP_CONTAINER_KEY } from '@ui/composables/useWorkspace';

const container = createAppContainer();
const app = createApp(App);
app.provide(APP_CONTAINER_KEY, container);
app.mount('#app');
