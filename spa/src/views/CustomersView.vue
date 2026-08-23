<template>
  <section>
    <div class="toolbar">
      <p class="meta">Customers</p>
      <span class="toolbar-slot" aria-hidden="true"></span>
      <span class="toolbar-slot" aria-hidden="true"></span>
      <button type="button" class="primary action-btn" @click="openCreate">New customer</button>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div class="table-wrap">
      <table class="desk">
        <thead>
          <tr>
            <th>Name</th>
            <th>Company</th>
            <th class="hide-sm">Email</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td colspan="4">No customers yet.</td>
          </tr>
          <tr v-for="row in rows" :key="row.recordID">
            <td>{{ row.Name }}</td>
            <td>{{ row.Company || "—" }}</td>
            <td class="hide-sm">{{ row.Email || "—" }}</td>
            <td>
              <button type="button" class="ghost edit-btn" @click="openEdit(row)">Edit</button>
              <button type="button" class="danger" @click="remove(row)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <CustomerFormDialog v-model:visible="dialog" :customer="editing" @save="persist" />
  </section>
</template>

<script setup>
import { inject, onMounted, ref } from "vue";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { mapToValues, resolveModule, resolveNamespace, valuesToMap } from "../corteza/api.js";
import CustomerFormDialog from "../components/CustomerFormDialog.vue";

const compose = inject("compose");
const confirm = useConfirm();
const toast = useToast();
const namespaceID = ref("");
const module = ref(null);
const rows = ref([]);
const error = ref("");
const dialog = ref(false);
const editing = ref(null);

function unwrap(result) {
  return result?.set || result?.response?.set || result || [];
}

async function load() {
  error.value = "";
  try {
    const ns = await resolveNamespace(compose, "plexys_homework");
    namespaceID.value = ns.namespaceID;
    module.value = await resolveModule(compose, ns.namespaceID, "Customer");
    const page = await compose.recordList({
      namespaceID: ns.namespaceID,
      moduleID: module.value.moduleID,
      limit: 200,
      sort: "createdAt DESC",
    });
    rows.value = unwrap(page).map((record) => ({ ...valuesToMap(record), recordID: record.recordID }));
  } catch (err) {
    error.value = err.message || String(err);
  }
}

function openCreate() {
  editing.value = null;
  dialog.value = true;
}

function openEdit(row) {
  editing.value = { ...row };
  dialog.value = true;
}

async function persist(form) {
  const values = mapToValues(form);
  try {
    if (editing.value?.recordID) {
      await compose.recordUpdate({
        namespaceID: namespaceID.value,
        moduleID: module.value.moduleID,
        recordID: editing.value.recordID,
        values,
      });
    } else {
      await compose.recordCreate({
        namespaceID: namespaceID.value,
        moduleID: module.value.moduleID,
        values,
      });
    }
    dialog.value = false;
    toast.add({ severity: "success", summary: "Customer saved", life: 2500 });
    await load();
  } catch (err) {
    toast.add({ severity: "error", summary: err.message || "Save failed", life: 4000 });
  }
}

function remove(row) {
  confirm.require({
    header: "Delete customer",
    message: `Delete ${row.Name}? Tickets that reference this customer will keep a stale ID until edited.`,
    acceptLabel: "Delete",
    rejectLabel: "Cancel",
    accept: async () => {
      await compose.recordDelete({
        namespaceID: namespaceID.value,
        moduleID: module.value.moduleID,
        recordID: row.recordID,
      });
      await load();
    },
  });
}

onMounted(load);
</script>
