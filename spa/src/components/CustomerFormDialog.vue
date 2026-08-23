<template>
  <Dialog
    v-model:visible="open"
    modal
    :header="customer ? 'Edit customer' : 'New customer'"
    :style="{ width: 'min(480px, 92vw)' }"
    :dismissableMask="false"
  >
    <form class="form-grid" @submit.prevent="save">
      <label class="field">
        Name
        <input v-model="form.Name" required name="name" />
      </label>
      <label class="field">
        Company
        <input v-model="form.Company" name="company" />
      </label>
      <label class="field">
        Email
        <input v-model="form.Email" type="email" name="email" />
      </label>
      <div class="dialog-actions">
        <button type="button" class="ghost" @click="open = false">Cancel</button>
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
  customer: Object,
});
const open = defineModel("visible", { type: Boolean });
const emit = defineEmits(["save"]);
const form = reactive({ Name: "", Company: "", Email: "" });

watch(
  () => [props.visible, props.customer],
  () => Object.assign(form, { Name: "", Company: "", Email: "" }, props.customer || {}),
  { immediate: true },
);

function save() {
  emit("save", { ...form });
}
</script>
