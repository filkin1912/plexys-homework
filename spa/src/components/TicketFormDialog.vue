<template>
  <Dialog
    v-model:visible="open"
    modal
    :header="ticket ? 'Edit ticket' : 'New ticket'"
    :style="{ width: 'min(560px, 92vw)' }"
    :dismissableMask="false"
    @update:visible="onClose"
  >
    <form class="form-grid" @submit.prevent="save">
      <label class="field">
        Subject
        <input v-model="form.Subject" required maxlength="200" name="subject" />
      </label>
      <label class="field">
        Description
        <textarea v-model="form.Description" rows="4" name="description"></textarea>
      </label>
      <label class="field">
        Status
        <select v-model="form.Status" required name="status">
          <option v-for="item in statuses" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>
      <label class="field">
        Priority
        <select v-model="form.Priority" required name="priority">
          <option v-for="item in priorities" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>
      <label class="field">
        Due date
        <input v-model="form.DueDate" type="datetime-local" name="due" />
      </label>
      <label class="field">
        Customer
        <select v-model="form.Customer" name="customer">
          <option value="">— none —</option>
          <option v-for="item in customers" :key="item.recordID" :value="item.recordID">
            {{ item.label }}
          </option>
        </select>
      </label>
      <div class="dialog-actions">
        <button type="button" class="ghost" @click="onClose(false)">Cancel</button>
        <button type="submit" class="primary">Save</button>
      </div>
    </form>
  </Dialog>
</template>

<script setup>
import { reactive, watch } from "vue";
import Dialog from "primevue/dialog";

const props = defineProps({
  visible: Boolean,
  ticket: Object,
  customers: { type: Array, default: () => [] },
});
const emit = defineEmits(["update:visible", "save"]);

const statuses = ["New", "In Progress", "Resolved", "Closed"];
const priorities = ["Low", "Medium", "High", "Urgent"];
const open = defineModel("visible", { type: Boolean });

const form = reactive(blank());

function blank() {
  return {
    Subject: "",
    Description: "",
    Status: "New",
    Priority: "Medium",
    DueDate: "",
    Customer: "",
  };
}

function toLocal(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

watch(
  () => [props.visible, props.ticket],
  () => {
    Object.assign(form, blank(), props.ticket || {});
    form.DueDate = toLocal(form.DueDate);
  },
  { immediate: true },
);

function onClose(value) {
  if (value === false) open.value = false;
  emit("update:visible", false);
}

function save() {
  emit("save", {
    ...form,
    DueDate: form.DueDate ? new Date(form.DueDate).toISOString() : "",
  });
}
</script>
