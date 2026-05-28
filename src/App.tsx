import {
  Download,
  LayoutDashboard,
  ListPlus,
  LogOut,
  RotateCcw,
  Settings,
  Tags,
  Trash2,
  Upload,
} from "lucide-react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { ChangeEvent, ElementType, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { TransactionForm } from "./components/TransactionForm";
import { defaultAppData } from "./data/defaultData";
import { sortTransactions, todayISO } from "./domain/finance";
import { formatCurrency, formatDate } from "./format";
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
} from "./types";
import { Dashboard } from "./components/Dashboard";

type Page = "dashboard" | "transactions" | "categories" | "settings";
type SyncState =
  | { mode: "checking" }
  | { mode: "local" }
  | { mode: "signed-out"; client: SupabaseClient }
  | { mode: "remote"; client: SupabaseClient; session: Session };

const appLogoPath = "/assets/nin-jah-ma-jod-logo.png";
const currentDate = new Date();

const initialFilter: PeriodFilter = {
  type: "month",
  year: currentDate.getFullYear(),
  month: currentDate.getMonth() + 1,
  day: currentDate.getDate(),
};

const navItems: Array<{ page: Page; label: string; icon: ElementType }> = [
  { page: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { page: "transactions", label: "รายการ", icon: ListPlus },
  { page: "categories", label: "หมวดหมู่", icon: Tags },
  { page: "settings", label: "Settings", icon: Settings },
];

const transactionPageSizeOptions = [5, 10, 20];

function getTransactionTypeLabel(type: Transaction["type"]): string {
  if (type === "income") return "รายรับ";
  if (type === "expense") return "รายจ่าย";
  return "ออมเงิน";
}

export default function App() {
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [filter, setFilter] = useState(initialFilter);
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
        if (isMounted) setData(remoteData);
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
    return <AuthPage client={syncState.client} errorMessage={syncError} />;
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
            onFilterChange={setFilter}
          />
        )}
        {activePage === "transactions" && (
          <TransactionsPage
            categories={data.categories}
            categoryById={categoryById}
            transactions={data.transactions}
            onAddTransaction={addTransaction}
            onDeleteTransaction={deleteTransaction}
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
}: {
  client: SupabaseClient;
  errorMessage: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
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
      setAuthNotice("สร้างบัญชีแล้ว กรุณายืนยัน email ก่อนเข้าสู่ระบบ");
    }
    setIsSubmitting(false);
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand auth-brand">
          <img className="brand-logo" src={appLogoPath} alt="NinJahMajod logo" />
          <div>
            <strong>NinJahMajod</strong>
            <small>Supabase sync</small>
          </div>
        </div>
        <p className="eyebrow">Online Sync</p>
        <h1>เข้าสู่ระบบเพื่อเก็บข้อมูลถาวร</h1>
        <p>
          ข้อมูลจะถูกผูกกับบัญชีของคุณและแยกจากผู้ใช้อื่นด้วย Supabase Row Level
          Security
        </p>

        <div className="segmented auth-mode" aria-label="เลือกโหมดเข้าสู่ระบบ">
          <button
            className={mode === "sign-in" ? "active" : ""}
            type="button"
            onClick={() => setMode("sign-in")}
          >
            Login
          </button>
          <button
            className={mode === "sign-up" ? "active" : ""}
            type="button"
            onClick={() => setMode("sign-up")}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
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
            Password
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
      </section>
    </main>
  );
}

function TransactionsPage({
  categories,
  categoryById,
  transactions,
  onAddTransaction,
  onDeleteTransaction,
}: {
  categories: Category[];
  categoryById: Map<string, Category>;
  transactions: Transaction[];
  onAddTransaction: (input: TransactionInput) => void | Promise<void>;
  onDeleteTransaction: (id: string) => void | Promise<void>;
}) {
  const sortedTransactions = sortTransactions(transactions);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(transactionPageSizeOptions[0]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const totalPages = Math.max(
    1,
    Math.ceil(sortedTransactions.length / pageSize),
  );
  const currentPage = Math.min(page, totalPages);
  const visibleTransactions = sortedTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

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
              {sortedTransactions.length === 0
                ? "ยังไม่มีรายการ"
                : `แสดง ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, sortedTransactions.length)} จาก ${sortedTransactions.length} รายการ`}
            </p>
          </div>
          <label className="page-size-control">
            จำนวนรายการต่อหน้า
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
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
                return (
                  <tr key={transaction.id}>
                    <td data-label="วันที่">{formatDate(transaction.date)}</td>
                    <td data-label="ประเภท">
                      <span className={`type-pill ${transaction.type}`}>
                        {getTransactionTypeLabel(transaction.type)}
                      </span>
                    </td>
                    <td data-label="หมวดหมู่">
                      <span
                        className="category-dot"
                        style={{ background: category?.color ?? "#64748b" }}
                      />
                      {category?.name ?? "ไม่พบหมวดหมู่"}
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
                        <button
                          className="icon-button danger"
                          type="button"
                          aria-label={`ลบ ${transaction.note || transaction.id}`}
                          onClick={() => setPendingDeleteId(transaction.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sortedTransactions.length === 0 && (
            <p className="empty-state">ยังไม่มีรายการ</p>
          )}
        </div>
        {sortedTransactions.length > 0 && (
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
          <p className="eyebrow">Categories & Budgets</p>
          <h1>หมวดหมู่และงบประมาณ</h1>
        </div>
      </div>

      <div className="split-grid categories-layout">
        <div className="panel category-editor-panel">
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
                      <small>
                        {isEditing ? "กำลังแก้ไข" : "แตะเพื่อแก้ไข"}
                      </small>
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
    <section className="page-stack" aria-label="Settings">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>จัดการข้อมูล</h1>
        </div>
      </div>

      <div className="settings-grid">
        <article className="panel setting-card">
          <Download size={24} />
          <h2>Export JSON</h2>
          <p>สำรองข้อมูลทั้งหมดเป็นไฟล์ JSON สำหรับนำกลับมาใช้ภายหลัง</p>
          <button className="primary-button" type="button" onClick={exportJson}>
            Export
          </button>
        </article>

        <article className="panel setting-card">
          <Upload size={24} />
          <h2>Import JSON</h2>
          <p>นำเข้าข้อมูลจากไฟล์ JSON ที่ export จากระบบนี้</p>
          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept="application/json"
            aria-label="Import JSON file"
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
            Import
          </button>
        </article>

        <article className="panel setting-card">
          <RotateCcw size={24} />
          <h2>Reset demo data</h2>
          <p>คืนค่าข้อมูลตัวอย่างและหมวดหมู่เริ่มต้น</p>
          {confirmReset ? (
            <div className="confirm-actions">
              <button
                className="danger-button"
                type="button"
                onClick={() => {
                  onReset();
                  setConfirmReset(false);
                }}
              >
                ยืนยัน Reset
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setConfirmReset(false)}
              >
                ยกเลิก
              </button>
            </div>
          ) : (
            <button
              className="danger-button"
              type="button"
              onClick={() => setConfirmReset(true)}
            >
              Reset
            </button>
          )}
        </article>

        {syncAccount && (
          <article className="panel setting-card">
            <LogOut size={24} />
            <h2>Supabase account</h2>
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
