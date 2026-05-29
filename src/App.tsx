import {
  Download,
  LayoutDashboard,
  ListPlus,
  LogOut,
  Pencil,
  RotateCcw,
  Save,
  Settings,
  Tags,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { ChangeEvent, ElementType, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { TransactionForm } from "./components/TransactionForm";
import { defaultAppData } from "./data/defaultData";
import {
  getMonthlyFilterForDate,
  getSelectableCategories,
  filterTransactionsForList,
  sortTransactions,
  todayISO,
  validateTransactionInput,
} from "./domain/finance";
import { formatCurrency, formatDate, getMonthName } from "./format";
import {
  loadAppData,
  normalizeAppData,
  saveAppData,
} from "./storage/appStorage";
import { getSupabaseClient } from "./storage/supabaseClient";
import {
  deleteRemoteCategory,
  deleteRemoteTransaction,
  loadRemoteAppData,
  saveRemoteAppData,
  upsertRemoteCategory,
  upsertRemoteTransaction,
} from "./storage/supabaseStorage";
import type {
  AppData,
  Category,
  CategoryType,
  PeriodFilter,
  Transaction,
  TransactionInput,
  TransactionListFilter,
  TransactionPageSize,
} from "./types";
import { Dashboard } from "./components/Dashboard";
import { ConfirmDialog } from "./components/ui/ConfirmDialog";

type Page = "dashboard" | "transactions" | "categories" | "settings";
type SyncState =
  | { mode: "checking" }
  | { mode: "local" }
  | { mode: "signed-out"; client: SupabaseClient }
  | { mode: "remote"; client: SupabaseClient; session: Session };

const appLogoPath = "/assets/nin-jah-ma-jod-logo.png";

const navItems: Array<{ page: Page; label: string; icon: ElementType }> = [
  { page: "dashboard", label: "ภาพรวม", icon: LayoutDashboard },
  { page: "transactions", label: "รายการ", icon: ListPlus },
  { page: "categories", label: "หมวดหมู่", icon: Tags },
  { page: "settings", label: "ตั้งค่า", icon: Settings },
];

const transactionPageSizeOptions: TransactionPageSize[] = [5, 10, 20];

function getTransactionTypeLabel(type: Transaction["type"]): string {
  if (type === "income") return "รายรับ";
  if (type === "expense") return "รายจ่าย";
  return "ออมเงิน";
}

export default function App() {
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [filter, setFilter] = useState<PeriodFilter>(() =>
    getMonthlyFilterForDate(new Date(), data.settings.paydayDay),
  );
  const [syncState, setSyncState] = useState<SyncState>(() => {
    const client = getSupabaseClient();
    return client ? { mode: "checking" } : { mode: "local" };
  });
  const [syncError, setSyncError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      return;
    }
    const supabaseClient = client;

    let isMounted = true;

    async function loadSignedInData(userId: string) {
      try {
        setSyncError("");
        const remoteData = await loadRemoteAppData(supabaseClient, userId);
        if (isMounted) {
          setData((current) => ({
            ...remoteData,
            settings: current.settings,
          }));
        }
      } catch (error) {
        if (isMounted) {
          setSyncError(
            error instanceof Error
              ? error.message
              : "โหลดข้อมูลจาก Supabase ไม่สำเร็จ",
          );
        }
      }
    }

    async function loadSession() {
      const { data: sessionData, error } =
        await supabaseClient.auth.getSession();
      if (!isMounted) return;
      if (error) {
        setSyncError(error.message);
        setSyncState({ mode: "signed-out", client: supabaseClient });
        return;
      }
      if (sessionData.session) {
        setSyncState({
          mode: "remote",
          client: supabaseClient,
          session: sessionData.session,
        });
        await loadSignedInData(sessionData.session.user.id);
      } else {
        setSyncState({ mode: "signed-out", client: supabaseClient });
      }
    }

    const { data: subscription } = supabaseClient.auth.onAuthStateChange(
      (_, session) => {
        if (!isMounted) return;
        setSyncError("");
        if (session) {
          setSyncState({ mode: "remote", client: supabaseClient, session });
          void loadSignedInData(session.user.id);
        } else {
          setSyncState({ mode: "signed-out", client: supabaseClient });
          setData(loadAppData());
        }
      },
    );

    void loadSession();

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (syncState.mode === "local" || syncState.mode === "signed-out") {
      saveAppData(data);
    }
  }, [data, syncState.mode]);

  const categoryById = useMemo(
    () => new Map(data.categories.map((category) => [category.id, category])),
    [data.categories],
  );

  async function persistRemote(
    change: (client: SupabaseClient, userId: string) => Promise<void>,
  ) {
    if (syncState.mode !== "remote") return true;
    setIsSaving(true);
    setSyncError("");
    try {
      await change(syncState.client, syncState.session.user.id);
      return true;
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "บันทึกข้อมูลไม่สำเร็จ",
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function updatePaydayDay(paydayDay: number) {
    setData((current) => {
      const nextData = {
        ...current,
        settings: {
          ...current.settings,
          paydayDay,
        },
      };
      saveAppData(nextData);
      return nextData;
    });
  }

  function updateTransactionPageSize(transactionPageSize: TransactionPageSize) {
    setData((current) => {
      const nextData = {
        ...current,
        settings: {
          ...current.settings,
          transactionPageSize,
        },
      };
      saveAppData(nextData);
      return nextData;
    });
  }

  async function addTransaction(input: TransactionInput) {
    const timestamp = new Date().toISOString();
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    if (syncState.mode === "remote") {
      const saved = await persistRemote((client, userId) =>
        upsertRemoteTransaction(client, userId, transaction),
      );
      if (!saved) return;
    }

    setData((current) => ({
      ...current,
      transactions: sortTransactions([transaction, ...current.transactions]),
    }));
  }

  async function deleteTransaction(id: string) {
    if (syncState.mode === "remote") {
      const saved = await persistRemote((client, userId) =>
        deleteRemoteTransaction(client, userId, id),
      );
      if (!saved) return;
    }

    setData((current) => ({
      ...current,
      transactions: current.transactions.filter(
        (transaction) => transaction.id !== id,
      ),
    }));
  }

  async function updateTransaction(id: string, input: TransactionInput) {
    const existingTransaction = data.transactions.find((transaction) => transaction.id === id);
    if (!existingTransaction) return false;

    const transaction: Transaction = {
      ...existingTransaction,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    if (syncState.mode === "remote") {
      const saved = await persistRemote((client, userId) =>
        upsertRemoteTransaction(client, userId, transaction),
      );
      if (!saved) return false;
    }

    setData((current) => ({
      ...current,
      transactions: sortTransactions(
        current.transactions.map((currentTransaction) =>
          currentTransaction.id === id ? transaction : currentTransaction,
        ),
      ),
    }));
    return true;
  }

  async function upsertCategory(category: Category) {
    if (syncState.mode === "remote") {
      const saved = await persistRemote((client, userId) =>
        upsertRemoteCategory(client, userId, category),
      );
      if (!saved) return;
    }

    setData((current) => {
      const exists = current.categories.some((item) => item.id === category.id);
      const categories = exists
        ? current.categories.map((item) =>
            item.id === category.id ? category : item,
          )
        : [...current.categories, category];

      return { ...current, categories };
    });
  }

  async function deleteCategory(id: string) {
    if (syncState.mode === "remote") {
      const saved = await persistRemote((client, userId) =>
        deleteRemoteCategory(client, userId, id),
      );
      if (!saved) return;
    }

    setData((current) => ({
      ...current,
      categories: current.categories.filter((category) => category.id !== id),
    }));
  }

  async function resetDemoData() {
    if (syncState.mode === "remote") {
      const saved = await persistRemote((client, userId) =>
        saveRemoteAppData(client, userId, defaultAppData),
      );
      if (!saved) return;
    }
    setData(defaultAppData);
  }

  async function importData(nextData: AppData) {
    const normalizedData = normalizeAppData(nextData);
    if (syncState.mode === "remote") {
      const saved = await persistRemote((client, userId) =>
        saveRemoteAppData(client, userId, normalizedData),
      );
      if (!saved) return;
    }
    setData(normalizedData);
  }

  async function signOut() {
    if (syncState.mode !== "remote") return;
    const { error } = await syncState.client.auth.signOut();
    if (error) setSyncError(error.message);
  }

  if (syncState.mode === "checking") {
    return (
      <StatusScreen
        title="กำลังตรวจสอบ session"
        message="กำลังเตรียมข้อมูลสำหรับการใช้งาน"
      />
    );
  }

  if (syncState.mode === "signed-out") {
    return (
      <AuthPage
        client={syncState.client}
        errorMessage={syncError}
        onUseLocal={() => {
          setSyncError("");
          setSyncState({ mode: "local" });
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="NinJahMajod navigation">
        <div className="brand">
          <img className="brand-logo" src={appLogoPath} alt="NinJahMajod logo" />
          <div>
            <strong>NinJahMajod</strong>
            <small>รายรับรายจ่าย</small>
          </div>
        </div>
        <nav aria-label="หน้าหลัก">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                className={activePage === item.page ? "active" : ""}
                aria-current={activePage === item.page ? "page" : undefined}
                onClick={() => setActivePage(item.page)}
                type="button"
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        {syncState.mode === "remote" && (
          <div className="sync-panel" aria-label="สถานะการ sync">
            <small>Supabase</small>
            <strong>{syncState.session.user.email}</strong>
            <button
              className="secondary-button"
              type="button"
              onClick={signOut}
            >
              <LogOut size={16} />
              ออกจากระบบ
            </button>
          </div>
        )}
      </aside>

      <main className="content">
        {(syncError || isSaving) && (
          <div
            className={syncError ? "sync-banner error" : "sync-banner"}
            role={syncError ? "alert" : "status"}
          >
            {syncError || "กำลังบันทึกข้อมูล"}
          </div>
        )}
        {activePage === "dashboard" && (
          <Dashboard
            transactions={data.transactions}
            categories={data.categories}
            filter={filter}
            paydayDay={data.settings.paydayDay}
            onFilterChange={setFilter}
            onPaydayDayChange={updatePaydayDay}
          />
        )}
        {activePage === "transactions" && (
          <TransactionsPage
            categories={data.categories}
            categoryById={categoryById}
            pageSize={data.settings.transactionPageSize}
            transactions={data.transactions}
            onAddTransaction={addTransaction}
            onDeleteTransaction={deleteTransaction}
            onUpdateTransaction={updateTransaction}
            onPageSizeChange={updateTransactionPageSize}
          />
        )}
        {activePage === "categories" && (
          <CategoriesPage
            categories={data.categories}
            transactions={data.transactions}
            onDeleteCategory={deleteCategory}
            onSaveCategory={upsertCategory}
          />
        )}
        {activePage === "settings" && (
          <SettingsPage
            data={data}
            syncAccount={
              syncState.mode === "remote"
                ? {
                    email: syncState.session.user.email ?? "",
                    onSignOut: signOut,
                  }
                : null
            }
            onImport={importData}
            onReset={resetDemoData}
          />
        )}
      </main>
    </div>
  );
}

function StatusScreen({ title, message }: { title: string; message: string }) {
  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-live="polite">
        <div className="brand auth-brand">
          <img className="brand-logo" src={appLogoPath} alt="NinJahMajod logo" />
          <div>
            <strong>NinJahMajod</strong>
            <small>รายรับรายจ่าย</small>
          </div>
        </div>
        <p className="eyebrow">Online Sync</p>
        <h1>{title}</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

function AuthPage({
  client,
  errorMessage,
  onUseLocal,
}: {
  client: SupabaseClient;
  errorMessage: string;
  onUseLocal: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setAuthError("");
    setAuthNotice("");

    const credentials = {
      email: email.trim(),
      password,
    };
    const result =
      mode === "sign-in"
        ? await client.auth.signInWithPassword(credentials)
        : await client.auth.signUp(credentials);

    if (result.error) setAuthError(result.error.message);
    if (!result.error && mode === "sign-up" && !result.data.session) {
      setAuthNotice("สร้างบัญชีแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
    }
    setIsSubmitting(false);
  }

  return (
    <main className="auth-shell">
      <section className={showAccountForm ? "auth-panel" : "auth-panel auth-panel-entry"}>
        <div className="brand auth-brand">
          <img className="brand-logo" src={appLogoPath} alt="NinJahMajod logo" />
          <div>
            <strong>NinJahMajod</strong>
            <small>รายรับรายจ่าย</small>
          </div>
        </div>
        <p className="eyebrow">เริ่มใช้งาน</p>
        <h1>เริ่มจัดการเงินของคุณ</h1>
        <p>บันทึกรายรับรายจ่าย ดูงบรายเดือน และเลือกได้ว่าจะเก็บข้อมูลบนเครื่องนี้หรือ sync ด้วยบัญชี Supabase</p>

        {!showAccountForm && (
          <div className="entry-actions" aria-label="วิธีเริ่มใช้งาน">
            <button className="primary-button" type="button" onClick={onUseLocal}>
              ใช้บนเครื่องนี้
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setAuthError("");
                setAuthNotice("");
                setShowAccountForm(true);
              }}
            >
              เข้าสู่ระบบเพื่อ sync
            </button>
          </div>
        )}

        {showAccountForm && (
          <>
            <div className="segmented auth-mode" aria-label="เลือกโหมดบัญชี">
              <button
                className={mode === "sign-in" ? "active" : ""}
                type="button"
                onClick={() => {
                  setAuthError("");
                  setAuthNotice("");
                  setMode("sign-in");
                }}
              >
                เข้าสู่ระบบ
              </button>
              <button
                className={mode === "sign-up" ? "active" : ""}
                type="button"
                onClick={() => {
                  setAuthError("");
                  setAuthNotice("");
                  setMode("sign-up");
                }}
              >
                สมัครบัญชี
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <label>
                อีเมล
                <input
                  autoComplete="email"
                  inputMode="email"
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                รหัสผ่าน
                <input
                  autoComplete={
                    mode === "sign-in" ? "current-password" : "new-password"
                  }
                  minLength={6}
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              {(authError || errorMessage) && (
                <p className="inline-error" role="alert">
                  {authError || errorMessage}
                </p>
              )}
              {authNotice && (
                <p className="inline-notice" role="status">
                  {authNotice}
                </p>
              )}
              <button
                className="primary-button"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? "กำลังดำเนินการ"
                  : mode === "sign-in"
                    ? "เข้าสู่ระบบ"
                    : "สร้างบัญชี"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

function TransactionsPage({
  categories,
  categoryById,
  pageSize,
  transactions,
  onAddTransaction,
  onDeleteTransaction,
  onUpdateTransaction,
  onPageSizeChange,
}: {
  categories: Category[];
  categoryById: Map<string, Category>;
  pageSize: TransactionPageSize;
  transactions: Transaction[];
  onAddTransaction: (input: TransactionInput) => void | Promise<void>;
  onDeleteTransaction: (id: string) => void | Promise<void>;
  onUpdateTransaction: (id: string, input: TransactionInput) => boolean | Promise<boolean>;
  onPageSizeChange: (pageSize: TransactionPageSize) => void;
}) {
  const [listFilter, setListFilter] = useState<TransactionListFilter>({});
  const [filtersOpen, setFiltersOpen] = useState(() => shouldOpenFiltersByDefault());
  const filteredTransactions = sortTransactions(filterTransactionsForList(transactions, listFilter));
  const [page, setPage] = useState(1);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / pageSize),
  );
  const currentPage = Math.min(page, totalPages);
  const visibleTransactions = filteredTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function updateListFilter(nextFilter: TransactionListFilter) {
    setListFilter(nextFilter);
    setEditingTransactionId(null);
    setPendingDeleteId(null);
    setPage(1);
  }

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(min-width: 921px)");
    const updateFilterVisibility = () => setFiltersOpen(mediaQuery.matches);

    updateFilterVisibility();
    mediaQuery.addEventListener("change", updateFilterVisibility);

    return () => mediaQuery.removeEventListener("change", updateFilterVisibility);
  }, []);

  return (
    <section className="page-stack" aria-label="รายการ">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Transactions</p>
          <h1>บันทึกรายรับรายจ่าย</h1>
        </div>
      </div>

      <div className="panel">
        <TransactionForm categories={categories} onSubmit={onAddTransaction} />
      </div>

      <div className="panel">
        <div className="panel-heading transaction-list-heading">
          <div>
            <h2>รายการล่าสุด</h2>
            <p className="panel-subtitle">
              {filteredTransactions.length === 0
                ? "ไม่พบรายการที่ตรงกับ filter"
                : `แสดง ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, filteredTransactions.length)} จาก ${filteredTransactions.length} รายการ`}
            </p>
          </div>
          <label className="page-size-control">
            จำนวนรายการต่อหน้า
            <select
              value={pageSize}
              onChange={(event) => {
                const selectedPageSize = Number(event.target.value) as TransactionPageSize;
                onPageSizeChange(selectedPageSize);
                setPage(1);
              }}
            >
              {transactionPageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <details
          className="filter-disclosure"
          open={filtersOpen}
          onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
        >
          <summary>ตัวกรอง</summary>
          <div className="transaction-filter-controls" aria-label="ตัวกรองรายการ">
            <label>
              กรองวันที่
              <input
                aria-label="กรองวันที่"
                type="date"
                value={listFilter.date ?? ""}
                onChange={(event) =>
                  updateListFilter({
                    ...listFilter,
                    date: event.target.value || undefined,
                  })
                }
              />
            </label>
            <label>
              กรองเดือน
              <select
                aria-label="กรองเดือน"
                value={listFilter.month ?? ""}
                onChange={(event) =>
                  updateListFilter({
                    ...listFilter,
                    month: event.target.value ? Number(event.target.value) : undefined,
                  })
                }
              >
                <option value="">ทุกเดือน</option>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option key={month} value={month}>
                    {getMonthName(month)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              กรองปี
              <input
                aria-label="กรองปี"
                type="number"
                value={listFilter.year ?? ""}
                onChange={(event) =>
                  updateListFilter({
                    ...listFilter,
                    year: event.target.value ? Number(event.target.value) : undefined,
                  })
                }
              />
            </label>
            <label>
              กรองหมวดหมู่
              <select
                aria-label="กรองหมวดหมู่"
                value={listFilter.categoryId ?? ""}
                onChange={(event) =>
                  updateListFilter({
                    ...listFilter,
                    categoryId: event.target.value || undefined,
                  })
                }
              >
                <option value="">ทุกหมวดหมู่</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>วันที่</th>
                <th>ประเภท</th>
                <th>หมวดหมู่</th>
                <th>โน้ต</th>
                <th className="amount-column">จำนวนเงิน</th>
                <th aria-label="จัดการ" />
              </tr>
            </thead>
            <tbody>
              {visibleTransactions.map((transaction) => {
                const category = categoryById.get(transaction.categoryId);
                if (editingTransactionId === transaction.id) {
                  return (
                    <tr className="transaction-edit-row" key={transaction.id}>
                      <td colSpan={6}>
                        <EditTransactionForm
                          categories={categories}
                          transaction={transaction}
                          onCancel={() => setEditingTransactionId(null)}
                          onSubmit={async (input) => {
                            const saved = await onUpdateTransaction(transaction.id, input);
                            if (saved) setEditingTransactionId(null);
                          }}
                        />
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={transaction.id}>
                    <td data-label="วันที่">{formatDate(transaction.date)}</td>
                    <td className="transaction-type-cell" data-label="ประเภท">
                      <span className={`type-pill ${transaction.type}`}>
                        {getTransactionTypeLabel(transaction.type)}
                      </span>
                    </td>
                    <td className="transaction-category-cell" data-label="หมวดหมู่">
                      <span className="transaction-category-value">
                        <span
                          className="category-dot"
                          style={{ background: category?.color ?? "#64748b" }}
                        />
                        <span>{category?.name ?? "ไม่พบหมวดหมู่"}</span>
                      </span>
                    </td>
                    <td data-label="โน้ต">{transaction.note || "-"}</td>
                    <td
                      data-label="จำนวนเงิน"
                      className={`amount-column ${transaction.type}`}
                    >
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td data-label="จัดการ">
                      {pendingDeleteId === transaction.id ? (
                        <div
                          className="confirm-actions"
                          aria-label="ยืนยันการลบรายการ"
                        >
                          <button
                            className="danger-button compact"
                            type="button"
                            onClick={() => {
                              onDeleteTransaction(transaction.id);
                              setPendingDeleteId(null);
                            }}
                          >
                            ยืนยัน
                          </button>
                          <button
                            className="secondary-button compact"
                            type="button"
                            onClick={() => setPendingDeleteId(null)}
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <div className="transaction-actions">
                          <button
                            className="icon-button"
                            type="button"
                            aria-label={`แก้ไข ${transaction.note || transaction.id}`}
                            onClick={() => {
                              setPendingDeleteId(null);
                              setEditingTransactionId(transaction.id);
                            }}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-button danger"
                            type="button"
                            aria-label={`ลบ ${transaction.note || transaction.id}`}
                            onClick={() => {
                              setEditingTransactionId(null);
                              setPendingDeleteId(transaction.id);
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredTransactions.length === 0 && (
            <p className="empty-state">ไม่พบรายการที่ตรงกับ filter</p>
          )}
        </div>
        {filteredTransactions.length > 0 && (
          <div className="pagination" aria-label="แบ่งหน้ารายการ">
            <button
              className="secondary-button compact"
              disabled={currentPage === 1}
              type="button"
              onClick={() =>
                setPage((currentPage) => Math.max(1, currentPage - 1))
              }
            >
              ก่อนหน้า
            </button>
            <span aria-live="polite">
              หน้า {currentPage} จาก {totalPages}
            </span>
            <button
              className="secondary-button compact"
              disabled={currentPage === totalPages}
              type="button"
              onClick={() =>
                setPage((currentPage) => Math.min(totalPages, currentPage + 1))
              }
            >
              หน้าถัดไป
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function shouldOpenFiltersByDefault() {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(min-width: 921px)").matches;
}

function EditTransactionForm({
  categories,
  transaction,
  onCancel,
  onSubmit,
}: {
  categories: Category[];
  transaction: Transaction;
  onCancel: () => void;
  onSubmit: (input: TransactionInput) => void | Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [note, setNote] = useState(transaction.note);
  const [errors, setErrors] = useState<string[]>([]);
  const selectableCategories = useMemo(() => {
    const categoriesForType = getSelectableCategories(categories, transaction.type);
    if (categoriesForType.some((category) => category.id === transaction.categoryId)) {
      return categoriesForType;
    }

    const currentCategory = categories.find((category) => category.id === transaction.categoryId);
    return currentCategory ? [currentCategory, ...categoriesForType] : categoriesForType;
  }, [categories, transaction.categoryId, transaction.type]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: TransactionInput = {
      type: transaction.type,
      categoryId,
      amount: Number(amount),
      date: transaction.date,
      note: note.trim(),
    };
    const nextErrors = validateTransactionInput(input);

    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }

    await onSubmit(input);
    setErrors([]);
  }

  return (
    <form
      className="transaction-edit-form"
      onSubmit={handleSubmit}
      aria-label={`แก้ไขรายการ ${transaction.note || transaction.id}`}
      noValidate
    >
      <label>
        หมวดหมู่
        <select
          aria-label="หมวดหมู่"
          required
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          {selectableCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        จำนวนเงิน
        <input
          aria-label="จำนวนเงิน"
          inputMode="decimal"
          min="0"
          required
          step="0.01"
          type="number"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <label className="wide">
        โน้ต
        <input
          aria-label="โน้ต"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {errors.length > 0 && (
        <div className="form-errors" role="alert">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
      <div className="transaction-edit-actions">
        <button className="primary-button compact" type="submit">
          <Save size={16} />
          บันทึกการแก้ไข
        </button>
        <button className="secondary-button compact" type="button" onClick={onCancel}>
          <X size={16} />
          ยกเลิก
        </button>
      </div>
    </form>
  );
}

function CategoriesPage({
  categories,
  transactions,
  onDeleteCategory,
  onSaveCategory,
}: {
  categories: Category[];
  transactions: Transaction[];
  onDeleteCategory: (id: string) => void | Promise<void>;
  onSaveCategory: (category: Category) => void | Promise<void>;
}) {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState<
    string | null
  >(null);
  const [deleteError, setDeleteError] = useState("");
  const transactionCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    transactions.forEach((transaction) => {
      counts.set(
        transaction.categoryId,
        (counts.get(transaction.categoryId) ?? 0) + 1,
      );
    });
    return counts;
  }, [transactions]);

  function startDeleteCategory(category: Category) {
    if ((transactionCountByCategory.get(category.id) ?? 0) > 0) {
      setDeleteError("ลบไม่ได้ เพราะยังมีรายการใช้หมวดหมู่นี้อยู่");
      setPendingDeleteCategoryId(null);
      return;
    }

    setDeleteError("");
    setPendingDeleteCategoryId(category.id);
  }

  async function confirmDeleteCategory(category: Category) {
    await onDeleteCategory(category.id);
    setEditingCategory(null);
    setPendingDeleteCategoryId(null);
    setDeleteError("");
  }

  return (
    <section className="page-stack categories-page" aria-label="หมวดหมู่">
      <div className="toolbar">
        <div>
          <p className="eyebrow">หมวดหมู่และงบ</p>
          <h1>หมวดหมู่และงบประมาณ</h1>
        </div>
      </div>

      <div className="split-grid categories-layout">
        <div
          className={editingCategory ? "panel category-editor-panel editing" : "panel category-editor-panel"}
          role="region"
          aria-label={
            editingCategory
              ? `ฟอร์มแก้ไขหมวดหมู่ ${editingCategory.name}`
              : "ฟอร์มเพิ่มหมวดหมู่"
          }
        >
          <div className="panel-heading">
            <h2>{editingCategory ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่"}</h2>
            {editingCategory && (
              <button
                className="secondary-button compact"
                type="button"
                onClick={() => {
                  setEditingCategory(null);
                  setPendingDeleteCategoryId(null);
                  setDeleteError("");
                }}
              >
                ยกเลิกการแก้ไข
              </button>
            )}
          </div>
          <CategoryForm
            key={editingCategory?.id ?? "new-category"}
            category={editingCategory}
            onSubmit={async (category) => {
              await onSaveCategory(category);
              setEditingCategory(null);
              setPendingDeleteCategoryId(null);
              setDeleteError("");
            }}
          />
          {editingCategory && (
            <div className="category-delete-actions">
              {deleteError && (
                <p className="inline-error" role="alert">
                  {deleteError}
                </p>
              )}
              {pendingDeleteCategoryId === editingCategory.id ? (
                <div
                  className="confirm-actions"
                  aria-label="ยืนยันการลบหมวดหมู่"
                >
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => void confirmDeleteCategory(editingCategory)}
                  >
                    ยืนยันลบหมวดหมู่
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setPendingDeleteCategoryId(null)}
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => startDeleteCategory(editingCategory)}
                >
                  ลบหมวดหมู่
                </button>
              )}
            </div>
          )}
        </div>

        <div className="panel category-list-panel">
          <h2>เลือกหมวดหมู่เพื่อแก้ไข</h2>
          <div
            className="category-list-scroll"
            role="region"
            aria-label="รายการหมวดหมู่เพื่อแก้ไข"
            tabIndex={0}
          >
            <div className="category-list">
              {categories.map((category) => {
                const isEditing = editingCategory?.id === category.id;
                const categoryType =
                  category.type === "both"
                    ? "ทั้งหมด"
                    : getTransactionTypeLabel(category.type);
                const budgetLabel = category.monthlyBudget
                  ? formatCurrency(category.monthlyBudget)
                  : "ไม่มีงบ";

                return (
                  <button
                    key={category.id}
                    aria-label={`แก้ไขหมวดหมู่ ${category.name} ${categoryType} ${budgetLabel} ${category.isActive ? "ใช้งาน" : "ปิด"}`}
                    aria-pressed={isEditing}
                    className={
                      isEditing ? "category-item selected" : "category-item"
                    }
                    type="button"
                    onClick={() => {
                      setEditingCategory(category);
                      setPendingDeleteCategoryId(null);
                      setDeleteError("");
                    }}
                  >
                    <span
                      className="category-dot"
                      style={{ background: category.color }}
                    />
                    <span className="category-name">
                      <strong>{category.name}</strong>
                      {isEditing && <small>กำลังแก้ไข</small>}
                    </span>
                    <span className="category-meta">
                      <small>ประเภท</small>
                      {categoryType}
                    </span>
                    <span className="category-meta">
                      <small>งบ</small>
                      {budgetLabel}
                    </span>
                    <span
                      className={category.isActive ? "status active" : "status"}
                    >
                      {category.isActive ? "ใช้งาน" : "ปิด"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CategoryForm({
  category,
  onSubmit,
}: {
  category: Category | null;
  onSubmit: (category: Category) => void | Promise<void>;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [type, setType] = useState<CategoryType>(category?.type ?? "expense");
  const [color, setColor] = useState(category?.color ?? "#2563eb");
  const [monthlyBudget, setMonthlyBudget] = useState(
    category?.monthlyBudget?.toString() ?? "",
  );
  const [isActive, setIsActive] = useState(category?.isActive ?? true);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    await onSubmit({
      id:
        category?.id ??
        `${trimmedName.toLowerCase().replaceAll(" ", "-")}-${crypto.randomUUID()}`,
      name: trimmedName,
      type,
      color,
      monthlyBudget:
        type !== "income" && monthlyBudget ? Number(monthlyBudget) : undefined,
      isActive,
    });

    if (!category) {
      setName("");
      setMonthlyBudget("");
    }
  }

  return (
    <form className="category-form" onSubmit={handleSubmit}>
      <label>
        ชื่อหมวดหมู่
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="เช่น กาแฟ"
        />
      </label>
      <label>
        ประเภท
        <select
          value={type}
          onChange={(event) => setType(event.target.value as CategoryType)}
        >
          <option value="expense">รายจ่าย</option>
          <option value="income">รายรับ</option>
          <option value="savings">ออมเงิน</option>
          <option value="both">ทั้งหมด</option>
        </select>
      </label>
      <label>
        สี
        <input
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
        />
      </label>
      <label>
        งบรายเดือน
        <input
          disabled={type === "income" || type === "savings"}
          min="0"
          type="number"
          value={monthlyBudget}
          onChange={(event) => setMonthlyBudget(event.target.value)}
          placeholder="0"
        />
      </label>
      <label className="checkbox-row">
        <input
          checked={isActive}
          type="checkbox"
          onChange={(event) => setIsActive(event.target.checked)}
        />
        ใช้งานหมวดหมู่นี้
      </label>
      <button className="primary-button" type="submit">
        บันทึกหมวดหมู่
      </button>
    </form>
  );
}

function SettingsPage({
  data,
  syncAccount,
  onImport,
  onReset,
}: {
  data: AppData;
  syncAccount: { email: string; onSignOut: () => void | Promise<void> } | null;
  onImport: (data: AppData) => void | Promise<void>;
  onReset: () => void | Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `money-flow-${todayISO()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await onImport(JSON.parse(text) as AppData);
      setImportError("");
      event.target.value = "";
    } catch {
      setImportError(
        "ไฟล์ JSON ไม่ถูกต้อง กรุณาเลือกไฟล์ที่ export จากระบบนี้",
      );
      event.target.value = "";
    }
  }

  return (
    <section className="page-stack" aria-label="ตั้งค่า">
      <div className="toolbar">
        <div>
          <p className="eyebrow">ตั้งค่า</p>
          <h1>จัดการข้อมูล</h1>
        </div>
      </div>

      <div className="settings-grid">
        <article className="panel setting-card">
          <Download size={24} />
          <h2>สำรองข้อมูล JSON</h2>
          <p>สำรองข้อมูลทั้งหมดเป็นไฟล์ JSON สำหรับนำกลับมาใช้ภายหลัง</p>
          <button className="primary-button" type="button" onClick={exportJson}>
            ดาวน์โหลด JSON
          </button>
        </article>

        <article className="panel setting-card">
          <Upload size={24} />
          <h2>นำเข้า JSON</h2>
          <p>นำเข้าข้อมูลจากไฟล์ JSON ที่ export จากระบบนี้</p>
          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept="application/json"
            aria-label="ไฟล์ JSON สำหรับนำเข้า"
            onChange={handleImport}
          />
          {importError && (
            <p className="inline-error" role="alert">
              {importError}
            </p>
          )}
          <button
            className="secondary-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            นำเข้า JSON
          </button>
        </article>

        <article className="panel setting-card">
          <RotateCcw size={24} />
          <h2>รีเซ็ตข้อมูลตัวอย่าง</h2>
          <p>คืนค่าข้อมูลตัวอย่างและหมวดหมู่เริ่มต้น</p>
          <ConfirmDialog
            confirmLabel="ยืนยันรีเซ็ต"
            description="การรีเซ็ตจะคืนค่าข้อมูลตัวอย่างและหมวดหมู่เริ่มต้น ข้อมูลที่เพิ่มไว้ในเครื่องนี้จะถูกแทนที่"
            onConfirm={() => {
              onReset();
              setConfirmReset(false);
            }}
            onOpenChange={setConfirmReset}
            open={confirmReset}
            title="ยืนยันการรีเซ็ตข้อมูล"
            trigger={
              <button className="danger-button" type="button">
                รีเซ็ตข้อมูลตัวอย่าง
              </button>
            }
          >
            <p className="inline-error">การทำงานนี้แทนที่ข้อมูลปัจจุบันในเครื่อง</p>
          </ConfirmDialog>
        </article>

        {syncAccount && (
          <article className="panel setting-card">
            <LogOut size={24} />
            <h2>บัญชี Supabase</h2>
            <p>{syncAccount.email}</p>
            <button
              className="secondary-button"
              type="button"
              onClick={syncAccount.onSignOut}
            >
              ออกจากระบบ
            </button>
          </article>
        )}
      </div>
    </section>
  );
}
