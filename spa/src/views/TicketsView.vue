<template>
  <section>
    <div class="toolbar">
      <p class="meta">{{ rangeLabel }}</p>
      <input
        v-model="query"
        class="search"
        type="search"
        placeholder="Filter by subject or customer"
        aria-label="Filter tickets by subject or customer"
      />
      <label class="filter">
        <span class="sr-only">Filter by priority</span>
        <select v-model="priority" aria-label="Filter by priority">
          <option value="">All priorities</option>
          <option v-for="item in priorities" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>
      <button type="button" class="primary action-btn" @click="openCreate">New ticket</button>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div class="table-wrap">
      <table class="desk">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Status</th>
            <th>Priority</th>
            <th class="hide-sm">Customer</th>
            <th class="hide-sm">Due</th>
            <th class="hide-sm">Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in pageRows" :key="row.recordID">
            <td>{{ row.Subject }}</td>
            <td><span class="pill" :class="row.Status">{{ row.Status }}</span></td>
            <td><span class="pill priority" :class="row.Priority">{{ row.Priority }}</span></td>
            <td class="hide-sm">{{ customerName(row.Customer) }}</td>
            <td class="hide-sm">{{ formatDate(row.DueDate) }}</td>
            <td class="hide-sm">{{ formatDate(row.updatedAt) }}</td>
            <td>
              <button type="button" class="ghost edit-btn" @click="openEdit(row)">Edit</button>
              <button type="button" class="danger" @click="remove(row)">Delete</button>
            </td>
          </tr>
          <tr v-for="n in emptySlots" :key="'pad-' + n" class="pad-row">
            <td colspan="7">{{ n === 1 && !pageRows.length ? "No tickets yet." : "" }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <nav v-if="pageCount > 1" class="pager" aria-label="Ticket pages">
      <button type="button" class="ghost" :disabled="page === 1" @click="page = page - 1">Previous</button>
      <button
        v-for="n in pageCount"
        :key="n"
        type="button"
        class="ghost"
        :class="{ current: n === page }"
        :aria-current="n === page ? 'page' : undefined"
        @click="page = n"
      >
        {{ n }}
      </button>
      <button type="button" class="ghost" :disabled="page === pageCount" @click="page = page + 1">Next</button>
    </nav>
    <TicketFormDialog v-model:visible="dialog" :ticket="editing" :customers="customers" @save="persist" />
  </section>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from "vue";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { mapToValues, resolveModule, resolveNamespace, valuesToMap } from "../corteza/api.js";
import TicketFormDialog from "../components/TicketFormDialog.vue";

const compose = inject("compose");
const confirm = useConfirm();
const toast = useToast();

const namespaceID = ref("");
const ticketModule = ref(null);
const customerModule = ref(null);
const records = ref([]);
const customers = ref([]);
const query = ref("");
const priority = ref("");
const priorities = ["Low", "Medium", "High", "Urgent"];
const error = ref("");
const dialog = ref(false);
const editing = ref(null);
const page = ref(1);
const pageSize = 7;

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  const p = priority.value;
  return records.value.filter((row) => {
    if (p && row.Priority !== p) return false;
    if (!q) return true;
    const subject = String(row.Subject || "").toLowerCase();
    const customer = customerName(row.Customer).toLowerCase();
    return subject.includes(q) || (customer !== "—" && customer.includes(q));
  });
});
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)));
const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize;
  return filtered.value.slice(start, start + pageSize);
});
const emptySlots = computed(() => Math.max(0, pageSize - pageRows.value.length));
const rangeLabel = computed(() => {
  const count = filtered.value.length;
  if (!count) return `0 of ${records.value.length} records`;
  const start = (page.value - 1) * pageSize + 1;
  const end = Math.min(page.value * pageSize, count);
  return `${start}–${end} of ${count} records`;
});

watch([query, priority], () => {
  page.value = 1;
});
watch(pageCount, (count) => {
  if (page.value > count) page.value = count;
});

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function customerName(id) {
  return customers.value.find((item) => item.recordID === id)?.label || "—";
}

function unwrap(result) {
  return result?.set || result?.response?.set || result || [];
}

async function load() {
  error.value = "";
  try {
    const ns = await resolveNamespace(compose, "plexys_homework");
    namespaceID.value = ns.namespaceID;
    ticketModule.value = await resolveModule(compose, ns.namespaceID, "SupportTicket");
    customerModule.value = await resolveModule(compose, ns.namespaceID, "Customer");
    const [ticketPage, customerPage] = await Promise.all([
      compose.recordList({
        namespaceID: ns.namespaceID,
        moduleID: ticketModule.value.moduleID,
        limit: 200,
        sort: "updatedAt DESC",
      }),
      compose.recordList({
        namespaceID: ns.namespaceID,
        moduleID: customerModule.value.moduleID,
        limit: 200,
        sort: "createdAt DESC",
      }),
    ]);
    records.value = unwrap(ticketPage).map((record) => ({
      ...valuesToMap(record),
      recordID: record.recordID,
      updatedAt: record.updatedAt,
      ownedBy: record.ownedBy,
    }));
    customers.value = unwrap(customerPage).map((record) => {
      const values = valuesToMap(record);
      return { recordID: record.recordID, label: values.Name || record.recordID, ...values };
    });
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
  const values = mapToValues({
    Subject: form.Subject,
    Description: form.Description,
    Status: form.Status,
    Priority: form.Priority,
    DueDate: form.DueDate,
    Customer: form.Customer,
  });
  try {
    if (editing.value?.recordID) {
      await compose.recordUpdate({
        namespaceID: namespaceID.value,
        moduleID: ticketModule.value.moduleID,
        recordID: editing.value.recordID,
        values,
      });
      toast.add({ severity: "success", summary: "Ticket updated", life: 2500 });
    } else {
      await compose.recordCreate({
        namespaceID: namespaceID.value,
        moduleID: ticketModule.value.moduleID,
        values,
      });
      toast.add({ severity: "success", summary: "Ticket created", life: 2500 });
    }
    dialog.value = false;
    await load();
  } catch (err) {
    toast.add({ severity: "error", summary: err.message || "Save failed", life: 4000 });
  }
}

function remove(row) {
  confirm.require({
    header: "Delete ticket",
    message: `Delete “${row.Subject}”? This cannot be undone from the desk.`,
    acceptLabel: "Delete",
    rejectLabel: "Cancel",
    accept: async () => {
      await compose.recordDelete({
        namespaceID: namespaceID.value,
        moduleID: ticketModule.value.moduleID,
        recordID: row.recordID,
      });
      toast.add({ severity: "success", summary: "Ticket deleted", life: 2500 });
      await load();
    },
  });
}

onMounted(load);
</script>
