<template>
  <div class="shell">
    <header class="top">
      <div class="brand">
        <h1>Support desk</h1>
        <p class="kicker">Plexys homework</p>
      </div>
      <nav aria-label="Primary">
        <RouterLink to="/" active-class="active">Tickets</RouterLink>
        <RouterLink to="/customers" active-class="active">Customers</RouterLink>
      </nav>
      <div class="who">
        <div class="who-id">
          <span class="who-name">Loged-in user:</span>
          <span class="who-email">{{ userEmail }}</span>
        </div>
        <button type="button" class="text-btn" @click="auth.logout()">Sign out</button>
      </div>
    </header>
    <main>
      <RouterView />
    </main>
    <Toast />
    <ConfirmDialog />
  </div>
</template>

<script setup>
import { computed, inject } from "vue";
import Toast from "primevue/toast";
import ConfirmDialog from "primevue/confirmdialog";

const auth = inject("auth");
const userEmail = computed(() => auth.user()?.email || auth.user()?.name || "unknown");
</script>
