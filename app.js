const STORAGE_KEY = "vi-nhe-transactions-v1";
const BUDGET_KEY = "vi-nhe-monthly-budget-v1";
const IMPORTED_KEY_PREFIX = "vi-nhe-cloud-imported-";
const appConfig = window.APP_CONFIG || {};
const hasCloudConfig = Boolean(appConfig.supabaseUrl && appConfig.supabaseAnonKey);
const hasPartialCloudConfig = Boolean(appConfig.supabaseUrl || appConfig.supabaseAnonKey) && !hasCloudConfig;
let cloudLoadGeneration = 0;
const COLORS = ["#42ad80", "#f1b369", "#8f88d5", "#e48571", "#62a9c8", "#b0ca68", "#dc81ad"];
const CATEGORIES = {
  expense: [
    { name: "Ăn uống", icon: "☕", color: "#fff2df", budget: 3_000_000 },
    { name: "Di chuyển", icon: "↗", color: "#e9f4fb", budget: 1_500_000 },
    { name: "Mua sắm", icon: "◈", color: "#f5edfb", budget: 2_000_000 },
    { name: "Nhà cửa", icon: "⌂", color: "#eaf5eb", budget: 4_000_000 },
    { name: "Giải trí", icon: "♫", color: "#fbeaf0", budget: 1_500_000 },
    { name: "Sức khỏe", icon: "✚", color: "#e8f6f4", budget: 1_000_000 },
    { name: "Khác", icon: "•", color: "#f0f2f1", budget: 2_000_000 },
  ],
  income: [
    { name: "Lương", icon: "▤", color: "#eaf5eb" },
    { name: "Thưởng", icon: "✦", color: "#fff2df" },
    { name: "Đầu tư", icon: "↗", color: "#e9f4fb" },
    { name: "Khác", icon: "•", color: "#f0f2f1" },
  ],
};

const today = new Date();
const currentMonth = toMonthString(today);
const monthPicker = document.querySelector("#monthPicker");
const transactionModal = document.querySelector("#transactionModal");
const form = document.querySelector("#transactionForm");
const categorySelect = document.querySelector("#transactionCategory");
const appShell = document.querySelector("#appShell");
const authScreen = document.querySelector("#authScreen");
const authForm = document.querySelector("#authForm");
const authMessage = document.querySelector("#authMessage");
let selectedMonth = currentMonth;
let selectedType = "expense";
let activeFilter = "all";
let searchQuery = "";
let toastTimer;
let authMode = "login";
let cloudUser = null;
let cloudChannel = null;
const supabaseClient = hasCloudConfig && window.supabase
  ? window.supabase.createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey)
  : null;

function toMonthString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function createDemoTransactions() {
  return [
    { id: crypto.randomUUID(), title: "Lương tháng", category: "Lương", type: "income", amount: 28_000_000, date: dateOffset(-2) },
    { id: crypto.randomUUID(), title: "Siêu thị WinMart", category: "Ăn uống", type: "expense", amount: 485_000, date: dateOffset(0) },
    { id: crypto.randomUUID(), title: "Cà phê cuối tuần", category: "Ăn uống", type: "expense", amount: 95_000, date: dateOffset(-1) },
    { id: crypto.randomUUID(), title: "Đổ xăng xe", category: "Di chuyển", type: "expense", amount: 120_000, date: dateOffset(-2) },
    { id: crypto.randomUUID(), title: "Phí thuê nhà", category: "Nhà cửa", type: "expense", amount: 5_000_000, date: dateOffset(-4) },
    { id: crypto.randomUUID(), title: "Mua tai nghe", category: "Mua sắm", type: "expense", amount: 890_000, date: dateOffset(-5) },
    { id: crypto.randomUUID(), title: "Xem phim cùng bạn", category: "Giải trí", type: "expense", amount: 220_000, date: dateOffset(-6) },
  ];
}

function loadTransactions() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      if (hasCloudConfig || hasPartialCloudConfig) return [];
      const demo = createDemoTransactions();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
      return demo;
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("Dữ liệu giao dịch không hợp lệ.");
    return parsed;
  } catch (error) {
    console.error("Không thể đọc dữ liệu giao dịch đã lưu.", error);
    return createDemoTransactions();
  }
}

function loadBudget() {
  const stored = localStorage.getItem(BUDGET_KEY);
  if (stored === null) return 15_000_000;
  const amount = Number(stored);
  return Number.isFinite(amount) && amount > 0 ? amount : 15_000_000;
}

let transactions = loadTransactions();
let monthlyBudget = loadBudget();

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function setSyncStatus(message, state = "online") {
  const status = document.querySelector("#syncStatus");
  status.className = `sync-status${state === "local" ? " local-mode" : ""}${state === "error" ? " sync-error" : ""}`;
  status.lastElementChild.textContent = message;
}

function setAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("error", isError);
}

function showAuthScreen() {
  appShell.hidden = true;
  authScreen.hidden = false;
}

function showDashboard() {
  authScreen.hidden = true;
  appShell.hidden = false;
}

function setAuthMode(mode) {
  authMode = mode;
  const signingUp = mode === "signup";
  document.querySelector("#authTitle").textContent = signingUp ? "Tạo tài khoản Ví Nhẹ" : "Đăng nhập Ví Nhẹ";
  document.querySelector("#authSubmit").textContent = signingUp ? "Tạo tài khoản" : "Đăng nhập";
  document.querySelector("#authModeToggle").textContent = signingUp
    ? "Đã có tài khoản? Đăng nhập"
    : "Chưa có tài khoản? Tạo tài khoản";
  document.querySelector("#authPassword").autocomplete = signingUp ? "new-password" : "current-password";
  setAuthMessage("");
}

function setProfile(user) {
  const email = user?.email || "";
  document.querySelector("#profileName").textContent = email || "Tài khoản cá nhân";
  document.querySelector("#profileDetails").textContent = "Đang đồng bộ đám mây";
  document.querySelector("#signOutButton").hidden = !user;
  document.querySelector("#mobileSignOut").hidden = !user;
  const localTransactions = loadTransactions();
  document.querySelector("#importLocalButton").hidden = !user
    || localTransactions.length === 0
    || localStorage.getItem(`${IMPORTED_KEY_PREFIX}${user.id}`) === "true";
}

async function loadCloudData() {
  if (!supabaseClient || !cloudUser) return;
  const userId = cloudUser.id;
  const generation = ++cloudLoadGeneration;
  setSyncStatus("Đang đồng bộ");
  const [transactionResult, budgetResult] = await Promise.all([
    supabaseClient.from("transactions").select("id,title,category,type,amount,date").order("date", { ascending: false }),
    supabaseClient.from("budget_settings").select("monthly_limit").eq("user_id", cloudUser.id).maybeSingle(),
  ]);
  if (transactionResult.error) throw transactionResult.error;
  if (budgetResult.error) throw budgetResult.error;
  if (!cloudUser || cloudUser.id !== userId || generation !== cloudLoadGeneration) return;
  transactions = transactionResult.data.map((item) => ({
    ...item,
    amount: Number(item.amount),
  }));
  monthlyBudget = budgetResult.data?.monthly_limit
    ? Number(budgetResult.data.monthly_limit)
    : 15_000_000;
  render();
  setSyncStatus("Đã đồng bộ");
}

function subscribeToCloudChanges() {
  if (!supabaseClient || !cloudUser) return;
  if (cloudChannel) void supabaseClient.removeChannel(cloudChannel);
  cloudChannel = supabaseClient
    .channel(`account-${cloudUser.id}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "transactions",
      filter: `user_id=eq.${cloudUser.id}`,
    }, () => {
      void loadCloudData().catch((error) => {
        console.error("Không thể đồng bộ giao dịch mới.", error);
        setSyncStatus("Lỗi đồng bộ", "error");
      });
    })
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "budget_settings",
      filter: `user_id=eq.${cloudUser.id}`,
    }, () => {
      void loadCloudData().catch((error) => {
        console.error("Không thể đồng bộ ngân sách mới.", error);
        setSyncStatus("Lỗi đồng bộ", "error");
      });
    })
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setSyncStatus("Mất kết nối", "error");
      }
    });
}

async function connectUser(user) {
  if (!supabaseClient || !user) return;
  if (cloudUser?.id === user.id && !appShell.hidden) return;
  cloudUser = user;
  setProfile(user);
  try {
    await loadCloudData();
    if (cloudUser?.id !== user.id) return;
    showDashboard();
    subscribeToCloudChanges();
    setProfile(user);
  } catch (error) {
    if (cloudUser?.id !== user.id) return;
    console.error("Không thể tải dữ liệu từ Supabase.", error);
    setSyncStatus("Lỗi đồng bộ", "error");
    showAuthScreen();
    document.querySelector("#authForm").hidden = true;
    document.querySelector("#authModeToggle").hidden = true;
    document.querySelector("#retryCloudLoad").hidden = false;
    setAuthMessage(`Không tải được dữ liệu: ${error.message}. Kiểm tra bảng và chính sách bảo mật theo HUONG-DAN-ONLINE.md.`, true);
  }
}

function disconnectUser() {
  cloudLoadGeneration++;
  if (supabaseClient && cloudChannel) void supabaseClient.removeChannel(cloudChannel);
  cloudChannel = null;
  cloudUser = null;
  transactions = [];
  monthlyBudget = 15_000_000;
  closeModal();
  render();
  document.querySelector("#authForm").hidden = false;
  document.querySelector("#authModeToggle").hidden = false;
  document.querySelector("#retryCloudLoad").hidden = true;
  document.querySelector("#authPassword").value = "";
  setProfile(null);
  showAuthScreen();
  setAuthMessage("");
}

function startCloudMode() {
  showAuthScreen();
  setSyncStatus("Đang kết nối");
  if (!hasCloudConfig) {
    document.querySelector("#authForm").hidden = true;
    document.querySelector("#authModeToggle").hidden = true;
    document.querySelector("#authConfigHelp").hidden = false;
    setAuthMessage(hasPartialCloudConfig
      ? "Cấu hình Supabase chưa đầy đủ."
      : "Chưa kết nối cơ sở dữ liệu Supabase.", true);
    return;
  }
  if (!supabaseClient) {
    document.querySelector("#authForm").hidden = true;
    document.querySelector("#authModeToggle").hidden = true;
    document.querySelector("#authConfigHelp").hidden = false;
    setAuthMessage("Không tải được thư viện đồng bộ. Kiểm tra kết nối internet rồi tải lại trang.", true);
    return;
  }
  supabaseClient.auth.onAuthStateChange((event, session) => {
    window.setTimeout(() => {
      if (!session) {
        disconnectUser();
      } else if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || cloudUser?.id !== session.user.id) {
        void connectUser(session.user);
      }
    }, 0);
  });
}

function money(amount) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount) + " ₫";
}

function compactMoney(amount) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return `${amount}`;
}

function formatDate(value, options = { day: "2-digit", month: "2-digit" }) {
  return new Intl.DateTimeFormat("vi-VN", options).format(new Date(`${value}T12:00:00`));
}

function monthTransactions() {
  return transactions.filter((transaction) => transaction.date.startsWith(selectedMonth));
}

function categoriesFor(type) {
  return CATEGORIES[type];
}

function categoryDetails(name, type = "expense") {
  return categoriesFor(type).find((item) => item.name === name) || categoriesFor(type).at(-1);
}

function render() {
  const monthItems = monthTransactions();
  const income = monthItems.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expenses = monthItems.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  document.querySelector("#balanceAmount").textContent = money(income - expenses);
  document.querySelector("#incomeAmount").textContent = money(income);
  document.querySelector("#expenseAmount").textContent = money(expenses);
  document.querySelector("#incomeCount").textContent = `${monthItems.filter((item) => item.type === "income").length} khoản thu`;
  document.querySelector("#expenseCount").textContent = `${monthItems.filter((item) => item.type === "expense").length} khoản chi`;
  renderTransactions(monthItems);
  renderCategoryBreakdown(monthItems, expenses);
  renderBudget(monthItems, expenses);
  renderChart(monthItems);
}

function renderTransactions(monthItems) {
  const rows = document.querySelector("#transactionRows");
  const visible = monthItems
    .filter((item) => activeFilter === "all" || item.type === activeFilter)
    .filter((item) => `${item.title} ${item.category}`.toLocaleLowerCase("vi").includes(searchQuery))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);
  rows.replaceChildren();
  document.querySelector("#emptyState").hidden = visible.length > 0;
  document.querySelector("table").hidden = visible.length === 0;
  for (const item of visible) {
    const details = categoryDetails(item.category, item.type);
    const row = document.createElement("tr");
    const titleCell = document.createElement("td");
    const titleWrap = document.createElement("div");
    titleWrap.className = "transaction-name";
    const icon = document.createElement("span");
    icon.className = "transaction-icon";
    icon.style.background = details.color;
    icon.textContent = details.icon;
    const title = document.createElement("span");
    title.textContent = item.title;
    titleWrap.append(icon, title);
    titleCell.append(titleWrap);
    const categoryCell = document.createElement("td");
    categoryCell.textContent = item.category;
    const dateCell = document.createElement("td");
    dateCell.textContent = formatDate(item.date);
    const amountCell = document.createElement("td");
    amountCell.className = `amount-cell${item.type === "income" ? " income" : ""}`;
    amountCell.textContent = `${item.type === "income" ? "+" : "−"}${money(item.amount)}`;
    const actionCell = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.className = "delete-transaction";
    removeButton.type = "button";
    removeButton.dataset.deleteId = item.id;
    removeButton.setAttribute("aria-label", `Xóa giao dịch ${item.title}`);
    removeButton.textContent = "×";
    actionCell.append(removeButton);
    row.append(titleCell, categoryCell, dateCell, amountCell, actionCell);
    rows.append(row);
  }
}

function renderCategoryBreakdown(monthItems, expenses) {
  const totals = new Map();
  monthItems.filter((item) => item.type === "expense").forEach((item) => {
    totals.set(item.category, (totals.get(item.category) || 0) + item.amount);
  });
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  let progress = 0;
  const segments = sorted.map(([name, amount], index) => {
    const start = progress;
    progress += expenses ? (amount / expenses) * 360 : 0;
    return `${COLORS[index]} ${start}deg ${progress}deg`;
  });
  document.querySelector("#categoryDonut").style.background = segments.length ? `conic-gradient(${segments.join(", ")})` : "conic-gradient(#dcefe5 0deg 360deg)";
  document.querySelector("#categoryTotal").textContent = compactMoney(expenses) + " ₫";
  const legend = document.querySelector("#categoryLegend");
  legend.replaceChildren();
  if (!sorted.length) {
    const empty = document.createElement("span");
    empty.className = "category-item";
    empty.textContent = "Chưa có khoản chi";
    legend.append(empty);
    return;
  }
  sorted.forEach(([name, amount], index) => {
    const item = document.createElement("div");
    item.className = "category-item";
    const label = document.createElement("span");
    label.className = "category-name";
    const color = document.createElement("i");
    color.className = "category-color";
    color.style.background = COLORS[index];
    const nameText = document.createElement("span");
    nameText.textContent = name;
    label.append(color, nameText);
    const total = document.createElement("strong");
    total.textContent = `${Math.round((amount / expenses) * 100)}%`;
    item.append(label, total);
    legend.append(item);
  });
}

function renderBudget(monthItems, expenses) {
  document.querySelector("#budgetSpent").textContent = compactMoney(expenses) + " ₫";
  document.querySelector("#budgetLimit").textContent = compactMoney(monthlyBudget) + " ₫";
  const percentage = Math.round((expenses / monthlyBudget) * 100);
  document.querySelector("#budgetPercent").textContent = `${percentage}%`;
  const progress = document.querySelector("#budgetProgress");
  progress.style.width = `${Math.min(percentage, 100)}%`;
  progress.classList.toggle("over", percentage >= 90);
  const note = document.querySelector("#budgetNote");
  if (percentage >= 100) {
    note.lastElementChild.textContent = "Bạn đã chạm ngân sách tháng này. Hãy cân nhắc các khoản chi nhé.";
  } else if (percentage >= 75) {
    note.lastElementChild.textContent = "Ngân sách sắp hết — hãy để ý các khoản chi còn lại nhé.";
  } else {
    note.lastElementChild.textContent = "Bạn đang quản lý chi tiêu rất tốt!";
  }
  const totals = new Map();
  monthItems.filter((item) => item.type === "expense").forEach((item) => {
    totals.set(item.category, (totals.get(item.category) || 0) + item.amount);
  });
  const list = document.querySelector("#budgetCategoryList");
  list.replaceChildren();
  const featured = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (featured.length === 0) featured.push(["Ăn uống", 0], ["Di chuyển", 0], ["Mua sắm", 0]);
  featured.forEach(([name, amount]) => {
    const details = categoryDetails(name);
    const item = document.createElement("div");
    item.className = "budget-category";
    const icon = document.createElement("span");
    icon.className = "budget-cat-icon";
    icon.style.background = details.color;
    icon.textContent = details.icon;
    const copy = document.createElement("div");
    copy.className = "budget-cat-copy";
    const categoryName = document.createElement("strong");
    categoryName.textContent = name;
    const categoryBudget = details.budget || 1_000_000;
    const subtext = document.createElement("span");
    subtext.textContent = `Ngân sách ${compactMoney(categoryBudget)} ₫`;
    copy.append(categoryName, subtext);
    const total = document.createElement("span");
    total.className = "budget-cat-amount";
    total.textContent = `${compactMoney(amount)} ₫`;
    item.append(icon, copy, total);
    list.append(item);
  });
}

function renderChart(monthItems) {
  const [year, month] = selectedMonth.split("-").map(Number);
  const selectedIsCurrent = selectedMonth === currentMonth;
  const endDay = selectedIsCurrent ? today.getDate() : new Date(year, month, 0).getDate();
  const visibleDays = Math.min(7, endDay);
  const days = Array.from({ length: visibleDays }, (_, index) => endDay - visibleDays + index + 1);
  const daily = days.map((day) => {
    const key = `${selectedMonth}-${String(day).padStart(2, "0")}`;
    return monthItems.filter((item) => item.date === key).reduce((totals, item) => {
      totals[item.type] += item.amount;
      return totals;
    }, { expense: 0, income: 0 });
  });
  const highest = Math.max(1, ...daily.flatMap((item) => [item.income, item.expense]));
  const chartHeight = 128;
  const top = 7;
  const base = 137;
  const unitHeight = chartHeight / highest;
  const labelStep = (base - top) / 4;
  let svg = `<svg viewBox="0 0 600 160" preserveAspectRatio="none" aria-hidden="true">`;
  for (let index = 0; index < 4; index++) {
    const y = top + labelStep * index;
    const amount = highest * (1 - index / 4);
    svg += `<line class="chart-gridline" x1="38" y1="${y}" x2="595" y2="${y}"></line><text class="chart-label" x="0" y="${y + 3}">${compactMoney(Math.round(amount))}</text>`;
  }
  daily.forEach((item, index) => {
    const center = 73 + index * 81;
    const incomeHeight = item.income ? Math.max(3, item.income * unitHeight) : 2;
    const expenseHeight = item.expense ? Math.max(3, item.expense * unitHeight) : 2;
    const incomeY = base - incomeHeight;
    const expenseY = base - expenseHeight;
    const labelDay = days[index];
    const date = new Date(year, month - 1, labelDay);
    const label = selectedIsCurrent && labelDay === endDay
      ? "Hôm nay"
      : new Intl.DateTimeFormat("vi-VN", { weekday: "short" }).format(date).replace(".", "");
    svg += `<rect class="chart-bar soft" x="${center - 12}" y="${incomeY}" width="12" height="${incomeHeight}" rx="3"><title>Thu ${labelDay}: ${money(item.income)}</title></rect>`;
    svg += `<rect class="chart-bar" x="${center + 2}" y="${expenseY}" width="12" height="${expenseHeight}" rx="3"><title>Chi ${labelDay}: ${money(item.expense)}</title></rect>`;
    svg += `<text class="chart-label" x="${center}" y="154" text-anchor="middle">${label}</text>`;
  });
  document.querySelector("#weeklyChart").innerHTML = `${svg}</svg>`;
}

function populateCategories() {
  const options = categoriesFor(selectedType);
  categorySelect.replaceChildren(...options.map((item) => {
    const option = document.createElement("option");
    option.value = item.name;
    option.textContent = item.name;
    return option;
  }));
}

function openModal() {
  transactionModal.hidden = false;
  form.reset();
  selectedType = "expense";
  document.querySelectorAll(".type-option").forEach((button) => button.classList.toggle("active", button.dataset.type === selectedType));
  populateCategories();
  document.querySelector("#transactionDate").value = new Date().toISOString().slice(0, 10);
  document.querySelector("#transactionTitle").focus();
}

function closeModal() {
  transactionModal.hidden = true;
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

document.querySelector("#todayLabel").textContent = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long", day: "2-digit", month: "long",
}).format(today).toLocaleUpperCase("vi");
monthPicker.value = selectedMonth;
if (hasCloudConfig || hasPartialCloudConfig) {
  startCloudMode();
} else {
  showDashboard();
  setSyncStatus("Chỉ lưu trên thiết bị", "local");
  render();
}

document.querySelector("#authModeToggle").addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "signup" : "login");
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;
  const submitButton = document.querySelector("#authSubmit");
  submitButton.disabled = true;
  setAuthMessage("");
  const data = new FormData(authForm);
  const credentials = {
    email: String(data.get("email")).trim(),
    password: String(data.get("password")),
  };
  try {
    const result = authMode === "signup"
      ? await supabaseClient.auth.signUp({
        ...credentials,
        options: { emailRedirectTo: window.location.origin },
      })
      : await supabaseClient.auth.signInWithPassword(credentials);
    if (result.error) throw result.error;
    if (authMode === "signup" && !result.data.session) {
      setAuthMessage("Tài khoản đã được tạo. Mở email để xác nhận, sau đó quay lại đăng nhập.");
    }
  } catch (error) {
    setAuthMessage(error.message || "Không thể đăng nhập. Vui lòng thử lại.", true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#retryCloudLoad").addEventListener("click", () => {
  if (cloudUser) void connectUser(cloudUser);
});

document.querySelector("#signOutButton").addEventListener("click", async () => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error("Không thể đăng xuất.", error);
    showToast("Không thể đăng xuất. Vui lòng thử lại.");
  }
});
document.querySelector("#mobileSignOut").addEventListener("click", () => {
  document.querySelector("#signOutButton").click();
});

document.querySelector("#importLocalButton").addEventListener("click", async () => {
  if (!supabaseClient || !cloudUser) return;
  const localItems = loadTransactions();
  if (localItems.length === 0) {
    showToast("Không có giao dịch trên thiết bị này để nhập.");
    return;
  }
  const accepted = window.confirm(`Nhập ${localItems.length} giao dịch đang lưu trên thiết bị này lên tài khoản? Hãy kiểm tra danh sách trước; dữ liệu mẫu cũng có thể được nhập.`);
  if (!accepted) return;
  const userId = cloudUser.id;
  const importButton = document.querySelector("#importLocalButton");
  importButton.disabled = true;
  const rows = localItems.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
    user_id: userId,
  }));
  try {
    const { error } = await supabaseClient.from("transactions").insert(rows);
    if (error) throw error;
    localStorage.setItem(`${IMPORTED_KEY_PREFIX}${userId}`, "true");
    await loadCloudData();
    if (cloudUser?.id === userId) setProfile(cloudUser);
    showToast(`Đã nhập ${rows.length} giao dịch lên đám mây.`);
  } catch (error) {
    console.error("Không thể nhập giao dịch trên thiết bị này.", error);
    showToast(`Không thể nhập dữ liệu: ${error.message}`);
  } finally {
    importButton.disabled = false;
  }
});

document.querySelector("#openAdd").addEventListener("click", openModal);
document.querySelector("#emptyAdd").addEventListener("click", openModal);
document.querySelector("#closeModal").addEventListener("click", closeModal);
document.querySelector("#cancelModal").addEventListener("click", closeModal);
transactionModal.addEventListener("click", (event) => {
  if (event.target === transactionModal) closeModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !transactionModal.hidden) closeModal();
});

document.querySelectorAll(".type-option").forEach((button) => {
  button.addEventListener("click", () => {
    selectedType = button.dataset.type;
    document.querySelectorAll(".type-option").forEach((option) => option.classList.toggle("active", option === button));
    populateCategories();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const amount = Number(data.get("amount"));
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    document.querySelector("#transactionAmount").setCustomValidity("Vui lòng nhập số tiền hợp lệ.");
    document.querySelector("#transactionAmount").reportValidity();
    return;
  }
  const transactionDate = String(data.get("date"));
  if (!transactionDate || Number.isNaN(new Date(`${transactionDate}T00:00:00`).getTime())) {
    document.querySelector("#transactionDate").setCustomValidity("Vui lòng chọn ngày hợp lệ.");
    document.querySelector("#transactionDate").reportValidity();
    return;
  }
  document.querySelector("#transactionAmount").setCustomValidity("");
  document.querySelector("#transactionDate").setCustomValidity("");
  const transaction = {
    id: crypto.randomUUID(),
    title: String(data.get("title")).trim(),
    amount,
    category: String(data.get("category")),
    date: transactionDate,
    type: selectedType,
  };
  if (!transaction.title) {
    document.querySelector("#transactionTitle").setCustomValidity("Nhập tên giao dịch.");
    document.querySelector("#transactionTitle").reportValidity();
    return;
  }
  document.querySelector("#transactionTitle").setCustomValidity("");
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    if (supabaseClient && cloudUser) {
      const { error } = await supabaseClient.from("transactions").insert({
        ...transaction,
        user_id: cloudUser.id,
      });
      if (error) throw error;
    } else {
      transactions.push(transaction);
      saveTransactions();
    }
  } catch (error) {
    console.error("Không thể lưu giao dịch.", error);
    showToast(`Không thể lưu giao dịch: ${error.message}`);
    return;
  } finally {
    submitButton.disabled = false;
  }
  if (supabaseClient && cloudUser) {
    transactions = [...transactions.filter((item) => item.id !== transaction.id), transaction];
  }
  closeModal();
  if (transactionDate.startsWith(selectedMonth)) render();
  else {
    selectedMonth = transactionDate.slice(0, 7);
    monthPicker.value = selectedMonth;
    render();
  }
  showToast("Đã lưu giao dịch thành công.");
});

document.querySelector("#transactionAmount").addEventListener("input", (event) => event.currentTarget.setCustomValidity(""));
document.querySelector("#transactionDate").addEventListener("input", (event) => event.currentTarget.setCustomValidity(""));
document.querySelector("#transactionTitle").addEventListener("input", (event) => event.currentTarget.setCustomValidity(""));
window.addEventListener("focus", () => {
  if (cloudUser) {
    void loadCloudData().catch((error) => {
      console.error("Không thể đồng bộ dữ liệu khi quay lại ứng dụng.", error);
      setSyncStatus("Lỗi đồng bộ", "error");
    });
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && cloudUser) {
    void loadCloudData().catch((error) => {
      console.error("Không thể đồng bộ dữ liệu khi quay lại ứng dụng.", error);
      setSyncStatus("Lỗi đồng bộ", "error");
    });
  }
});
monthPicker.addEventListener("change", () => {
  if (!monthPicker.value) {
    monthPicker.value = selectedMonth;
    return;
  }
  selectedMonth = monthPicker.value;
  render();
});

document.querySelectorAll(".filter-tab").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter-tab").forEach((tab) => tab.classList.toggle("selected", tab === button));
    renderTransactions(monthTransactions());
  });
});
document.querySelector("#searchInput").addEventListener("input", (event) => {
  searchQuery = event.currentTarget.value.trim().toLocaleLowerCase("vi");
  renderTransactions(monthTransactions());
});
document.querySelector("#transactionRows").addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;
  const transaction = transactions.find((item) => item.id === button.dataset.deleteId);
  if (!transaction) return;
  void (async () => {
    try {
      if (supabaseClient && cloudUser) {
        const { error } = await supabaseClient.from("transactions").delete().eq("id", transaction.id);
        if (error) throw error;
      }
      transactions = transactions.filter((item) => item.id !== transaction.id);
      if (!supabaseClient || !cloudUser) saveTransactions();
      render();
      showToast("Đã xóa giao dịch.");
    } catch (error) {
      console.error("Không thể xóa giao dịch.", error);
      showToast(`Không thể xóa giao dịch: ${error.message}`);
    }
  })();
});
document.querySelector("#editBudget").addEventListener("click", () => {
  const value = window.prompt("Nhập ngân sách chi tiêu tháng (VNĐ):", String(monthlyBudget));
  if (value === null) return;
  const amount = Number(value.replace(/[^\d]/g, ""));
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    showToast("Ngân sách cần là số tiền lớn hơn 0.");
    return;
  }
  void (async () => {
    try {
      if (supabaseClient && cloudUser) {
        const { error } = await supabaseClient.from("budget_settings").upsert({
          user_id: cloudUser.id,
          monthly_limit: amount,
        }, { onConflict: "user_id" });
        if (error) throw error;
      } else {
        localStorage.setItem(BUDGET_KEY, String(amount));
      }
      monthlyBudget = amount;
      renderBudget(monthTransactions(), monthTransactions().filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0));
      showToast("Đã cập nhật ngân sách.");
    } catch (error) {
      console.error("Không thể cập nhật ngân sách.", error);
      showToast(`Không thể cập nhật ngân sách: ${error.message}`);
    }
  })();
});

document.querySelector("#viewAll").addEventListener("click", () => {
  activeFilter = "all";
  searchQuery = "";
  document.querySelector("#searchInput").value = "";
  document.querySelectorAll(".filter-tab").forEach((tab) => tab.classList.toggle("selected", tab.dataset.filter === "all"));
  renderTransactions(monthTransactions());
});

document.querySelectorAll(".nav-link").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link === button));
    document.getElementById(button.dataset.target).scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

document.querySelector("#chartRange").addEventListener("click", () => {
  showToast("Biểu đồ đang hiển thị 7 ngày gần nhất.");
});
