import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";
import ToastService from "primevue/toastservice";
import ConfirmationService from "primevue/confirmationservice";
import App from "./App.vue";
import TicketsView from "./views/TicketsView.vue";
import CustomersView from "./views/CustomersView.vue";
import { createAuth } from "./corteza/auth.js";
import { createCompose } from "./corteza/api.js";
import "primeicons/primeicons.css";
import "./styles.css";

const router = createRouter({
  history: createWebHistory("/tickets/"),
  routes: [
    { path: "/", name: "tickets", component: TicketsView },
    { path: "/customers", name: "customers", component: CustomersView },
    { path: "/auth/callback", name: "callback", component: TicketsView },
  ],
});

const auth = createAuth();
const app = createApp(App);

app.use(router);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: { darkModeSelector: false },
  },
});
app.use(ToastService);
app.use(ConfirmationService);

app.config.globalProperties.$auth = auth;

auth
  .ensure()
  .then(() => {
    app.provide("auth", auth);
    app.provide("compose", createCompose(() => auth.token()));
    app.mount("#app");
  })
  .catch((err) => {
    document.getElementById("app").textContent =
      err?.message || "Support desk failed to start. Refresh the page.";
  });
