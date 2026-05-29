import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { defaultAppData } from "./data/defaultData";
import { STORAGE_KEY } from "./storage/appStorage";

describe("App smoke flow", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds a category, records a backdated expense, and reflects it in the dashboard", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "หมวดหมู่" }));
    await user.type(screen.getByPlaceholderText("เช่น กาแฟ"), "กาแฟ");
    await user.clear(screen.getByPlaceholderText("0"));
    await user.type(screen.getByPlaceholderText("0"), "1200");
    await user.click(screen.getByRole("button", { name: "บันทึกหมวดหมู่" }));

    await user.click(screen.getByRole("button", { name: "รายการ" }));
    const addTransactionForm = screen.getByRole("form", { name: "เพิ่มรายการ" });
    await user.selectOptions(
      within(addTransactionForm).getByLabelText("หมวดหมู่"),
      within(addTransactionForm).getByRole("option", { name: "กาแฟ" }),
    );
    await user.type(within(addTransactionForm).getByLabelText("จำนวนเงิน"), "85");
    await user.clear(within(addTransactionForm).getByLabelText("วันที่"));
    await user.type(within(addTransactionForm).getByLabelText("วันที่"), "2026-05-10");
    await user.type(within(addTransactionForm).getByLabelText("โน้ต"), "ลาเต้");
    await user.click(within(addTransactionForm).getByRole("button", { name: "เพิ่มรายการ" }));

    const table = screen.getByRole("table");
    expect(within(table).getByText("กาแฟ")).toBeInTheDocument();
    expect(within(table).getByText("ลาเต้")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ภาพรวม" }));
    await user.clear(screen.getByLabelText("ปี"));
    await user.type(screen.getByLabelText("ปี"), "2026");
    await user.selectOptions(screen.getByLabelText("เดือน"), "5");

    expect(screen.getAllByText("฿7,860").length).toBeGreaterThan(0);
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain("กาแฟ");
  });

  it("uses the NinJahMajod logo in the app shell brand", () => {
    render(<App />);

    const appShell = screen.getByRole("complementary", {
      name: "NinJahMajod navigation",
    });

    expect(within(appShell).getByRole("img", { name: "NinJahMajod logo" })).toHaveAttribute(
      "src",
      "/assets/nin-jah-ma-jod-logo.png",
    );
  });

  it("records savings and reflects total saved on the dashboard", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "รายการ" }));
    await user.click(screen.getByRole("button", { name: "ออมเงิน" }));
    await user.selectOptions(screen.getByLabelText("หมวดหมู่"), "savings");
    await user.type(screen.getByLabelText("จำนวนเงิน"), "2500");
    await user.clear(screen.getByLabelText("วันที่"));
    await user.type(screen.getByLabelText("วันที่"), "2026-05-05");
    await user.type(screen.getByLabelText("โน้ต"), "เงินสำรอง");
    await user.click(screen.getByRole("button", { name: "เพิ่มรายการ" }));

    expect(screen.getByText("เงินสำรอง")).toBeInTheDocument();
    expect(screen.getAllByText("ออมเงิน").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "ภาพรวม" }));
    await user.clear(screen.getByLabelText("ปี"));
    await user.type(screen.getByLabelText("ปี"), "2026");
    await user.selectOptions(screen.getByLabelText("เดือน"), "5");

    expect(screen.getByText("ออมเงินทั้งหมด")).toBeInTheDocument();
    expect(screen.getAllByText("฿2,500").length).toBeGreaterThan(0);
  });

  it("persists the selected payday day for the next app load", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.selectOptions(screen.getByRole("combobox", { name: "วันเงินเดือนออก" }), "25");

    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('"paydayDay":25');

    unmount();
    render(<App />);

    expect(screen.getByRole("combobox", { name: "วันเงินเดือนออก" })).toHaveValue("25");
    expect(screen.getByText("รอบเงินเดือน 25 พ.ค. - 24 มิ.ย.")).toBeInTheDocument();
  });

  it("opens on the next salary month after the saved payday has passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 28));
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...defaultAppData,
        settings: {
          ...defaultAppData.settings,
          paydayDay: 25,
        },
      }),
    );

    render(<App />);

    expect(screen.getByLabelText("เดือน")).toHaveValue("6");
    expect(screen.getByText("รอบเงินเดือน 25 พ.ค. - 24 มิ.ย.")).toBeInTheDocument();
  });

  it("requires confirmation before deleting a transaction", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "รายการ" }));
    expect(screen.getByText("กาแฟและน้ำดื่ม")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ลบ กาแฟและน้ำดื่ม" }));
    expect(screen.getByText("กาแฟและน้ำดื่ม")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ยืนยัน" }));
    expect(screen.queryByText("กาแฟและน้ำดื่ม")).not.toBeInTheDocument();
  });

  it("edits a transaction category, note, and amount", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "รายการ" }));
    await user.click(screen.getByRole("button", { name: "แก้ไข กาแฟและน้ำดื่ม" }));

    const editForm = screen.getByRole("form", { name: "แก้ไขรายการ กาแฟและน้ำดื่ม" });
    await user.selectOptions(
      within(editForm).getByLabelText("หมวดหมู่"),
      within(editForm).getByRole("option", { name: "ค่าอาหาร" }),
    );
    await user.clear(within(editForm).getByLabelText("จำนวนเงิน"));
    await user.type(within(editForm).getByLabelText("จำนวนเงิน"), "150");
    await user.clear(within(editForm).getByLabelText("โน้ต"));
    await user.type(within(editForm).getByLabelText("โน้ต"), "กาแฟแก้ไข");
    await user.click(within(editForm).getByRole("button", { name: "บันทึกการแก้ไข" }));

    const table = screen.getByRole("table");
    const updatedRow = within(table).getByText("กาแฟแก้ไข").closest("tr");
    expect(updatedRow).not.toBeNull();
    expect(within(updatedRow as HTMLTableRowElement).getByText("ค่าอาหาร")).toBeInTheDocument();
    expect(within(updatedRow as HTMLTableRowElement).getByText("฿150")).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain("กาแฟแก้ไข");
  });

  it("paginates the transaction list and lets users change page size", async () => {
    const transactions = Array.from({ length: 12 }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");

      return {
        id: `tx-${day}`,
        type: "expense" as const,
        categoryId: "food",
        amount: index + 1,
        date: `2026-05-${day}`,
        note: `รายการที่ ${day}`,
        createdAt: `2026-05-${day}T02:00:00.000Z`,
        updatedAt: `2026-05-${day}T02:00:00.000Z`,
      };
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaultAppData, transactions }));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "รายการ" }));

    expect(screen.getByText("หน้า 1 จาก 3")).toBeInTheDocument();
    expect(screen.getByText("รายการที่ 12")).toBeInTheDocument();
    expect(screen.queryByText("รายการที่ 07")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "หน้าถัดไป" }));

    expect(screen.getByText("หน้า 2 จาก 3")).toBeInTheDocument();
    expect(screen.getByText("รายการที่ 07")).toBeInTheDocument();
    expect(screen.queryByText("รายการที่ 12")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("จำนวนรายการต่อหน้า"), "10");

    expect(screen.getByText("หน้า 1 จาก 2")).toBeInTheDocument();
    expect(screen.getByText("รายการที่ 12")).toBeInTheDocument();
    expect(screen.getByText("รายการที่ 03")).toBeInTheDocument();
    expect(screen.queryByText("รายการที่ 02")).not.toBeInTheDocument();
  });

  it("remembers the selected transaction page size when returning to the list", async () => {
    const transactions = Array.from({ length: 12 }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");

      return {
        id: `tx-${day}`,
        type: "expense" as const,
        categoryId: "food",
        amount: index + 1,
        date: `2026-05-${day}`,
        note: `รายการที่ ${day}`,
        createdAt: `2026-05-${day}T02:00:00.000Z`,
        updatedAt: `2026-05-${day}T02:00:00.000Z`,
      };
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaultAppData, transactions }));
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.click(screen.getByRole("button", { name: "รายการ" }));
    await user.selectOptions(screen.getByLabelText("จำนวนรายการต่อหน้า"), "10");
    await user.click(screen.getByRole("button", { name: "ภาพรวม" }));
    await user.click(screen.getByRole("button", { name: "รายการ" }));

    expect(screen.getByLabelText("จำนวนรายการต่อหน้า")).toHaveValue("10");
    expect(screen.getByText("หน้า 1 จาก 2")).toBeInTheDocument();

    unmount();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "รายการ" }));

    expect(screen.getByLabelText("จำนวนรายการต่อหน้า")).toHaveValue("10");
    expect(screen.getByText("หน้า 1 จาก 2")).toBeInTheDocument();
  });

  it("filters transactions by date, month, year, and category", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...defaultAppData,
        transactions: [
          {
            id: "filter-match",
            type: "expense",
            categoryId: "food",
            amount: 120,
            date: "2026-05-10",
            note: "รายการที่ตรง filter",
            createdAt: "2026-05-10T02:00:00.000Z",
            updatedAt: "2026-05-10T02:00:00.000Z",
          },
          {
            id: "wrong-day",
            type: "expense",
            categoryId: "food",
            amount: 95,
            date: "2026-05-11",
            note: "คนละวัน",
            createdAt: "2026-05-11T02:00:00.000Z",
            updatedAt: "2026-05-11T02:00:00.000Z",
          },
          {
            id: "wrong-month",
            type: "expense",
            categoryId: "food",
            amount: 80,
            date: "2026-06-10",
            note: "คนละเดือน",
            createdAt: "2026-06-10T02:00:00.000Z",
            updatedAt: "2026-06-10T02:00:00.000Z",
          },
          {
            id: "wrong-category",
            type: "expense",
            categoryId: "rent",
            amount: 7500,
            date: "2026-05-10",
            note: "คนละหมวด",
            createdAt: "2026-05-10T03:00:00.000Z",
            updatedAt: "2026-05-10T03:00:00.000Z",
          },
        ],
      }),
    );
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "รายการ" }));
    await user.type(screen.getByLabelText("กรองวันที่"), "2026-05-10");
    await user.selectOptions(screen.getByLabelText("กรองเดือน"), "5");
    await user.clear(screen.getByLabelText("กรองปี"));
    await user.type(screen.getByLabelText("กรองปี"), "2026");
    await user.selectOptions(screen.getByLabelText("กรองหมวดหมู่"), "food");

    expect(screen.getByText("รายการที่ตรง filter")).toBeInTheDocument();
    expect(screen.queryByText("คนละวัน")).not.toBeInTheDocument();
    expect(screen.queryByText("คนละเดือน")).not.toBeInTheDocument();
    expect(screen.queryByText("คนละหมวด")).not.toBeInTheDocument();
    expect(screen.getByText("แสดง 1-1 จาก 1 รายการ")).toBeInTheDocument();
  });

  it("marks transaction cells for compact mobile reading", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "รายการ" }));
    await user.click(screen.getByRole("button", { name: "ออมเงิน" }));
    await user.selectOptions(
      screen.getByLabelText("หมวดหมู่"),
      "savings",
    );
    await user.type(screen.getByLabelText("จำนวนเงิน"), "2500");
    await user.type(screen.getByLabelText("โน้ต"), "เงินสำรอง");
    await user.click(screen.getByRole("button", { name: "เพิ่มรายการ" }));

    const savingsRow = screen.getByText("เงินสำรอง").closest("tr");
    expect(savingsRow).not.toBeNull();
    expect(within(savingsRow as HTMLTableRowElement).getByText("ออมเงิน").closest("td")).toHaveClass(
      "transaction-type-cell",
    );
    expect(within(savingsRow as HTMLTableRowElement).getByText("เงินออม").closest("td")).toHaveClass(
      "transaction-category-cell",
    );
  });

  it("requires confirmation before resetting demo data", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "รายการ" }));
    await user.selectOptions(screen.getByLabelText("หมวดหมู่"), "food");
    await user.type(screen.getByLabelText("จำนวนเงิน"), "42");
    await user.type(screen.getByLabelText("โน้ต"), "ทดสอบ reset");
    await user.click(screen.getByRole("button", { name: "เพิ่มรายการ" }));
    expect(screen.getByText("ทดสอบ reset")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ตั้งค่า" }));
    await user.click(screen.getByRole("button", { name: "รีเซ็ตข้อมูลตัวอย่าง" }));
    expect(screen.getByRole("alertdialog", { name: "ยืนยันการรีเซ็ตข้อมูล" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ยกเลิก" }));
    await user.click(screen.getByRole("button", { name: "รายการ" }));
    expect(screen.getByText("ทดสอบ reset")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ตั้งค่า" }));
    await user.click(screen.getByRole("button", { name: "รีเซ็ตข้อมูลตัวอย่าง" }));
    await user.click(screen.getByRole("button", { name: "ยืนยันรีเซ็ต" }));
    await user.click(screen.getByRole("button", { name: "รายการ" }));
    expect(screen.queryByText("ทดสอบ reset")).not.toBeInTheDocument();
  });

  it("uses Thai-first primary navigation labels", () => {
    render(<App />);

    const navigation = screen.getByRole("navigation", { name: "หน้าหลัก" });

    expect(within(navigation).getByRole("button", { name: "ภาพรวม" })).toBeInTheDocument();
    expect(within(navigation).getByRole("button", { name: "รายการ" })).toBeInTheDocument();
    expect(within(navigation).getByRole("button", { name: "หมวดหมู่" })).toBeInTheDocument();
    expect(within(navigation).getByRole("button", { name: "ตั้งค่า" })).toBeInTheDocument();
    expect(within(navigation).queryByRole("button", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("lets mobile users choose a category to edit and cancel back to add mode", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "หมวดหมู่" }));

    const foodCategory = screen.getByRole("button", { name: /แก้ไขหมวดหมู่ ค่าอาหาร/ });
    expect(foodCategory).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("region", { name: "รายการหมวดหมู่เพื่อแก้ไข" })).toHaveClass("category-list-scroll");

    await user.click(foodCategory);

    expect(screen.getByRole("heading", { name: "แก้ไขหมวดหมู่" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "ฟอร์มแก้ไขหมวดหมู่ ค่าอาหาร" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /แก้ไขหมวดหมู่ ค่าอาหาร/ })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "ยกเลิกการแก้ไข" }));

    expect(screen.getByRole("heading", { name: "เพิ่มหมวดหมู่" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /แก้ไขหมวดหมู่ ค่าอาหาร/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("deletes an unused category after confirmation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "หมวดหมู่" }));
    await user.type(screen.getByPlaceholderText("เช่น กาแฟ"), "ค่าสมาชิก");
    await user.click(screen.getByRole("button", { name: "บันทึกหมวดหมู่" }));

    const categoryButton = screen.getByRole("button", { name: /แก้ไขหมวดหมู่ ค่าสมาชิก/ });
    await user.click(categoryButton);
    await user.click(screen.getByRole("button", { name: "ลบหมวดหมู่" }));

    expect(screen.getByRole("button", { name: "ยืนยันลบหมวดหมู่" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /แก้ไขหมวดหมู่ ค่าสมาชิก/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ยืนยันลบหมวดหมู่" }));

    expect(screen.queryByRole("button", { name: /แก้ไขหมวดหมู่ ค่าสมาชิก/ })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toContain("ค่าสมาชิก");
  });

  it("does not delete categories that are still used by transactions", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "หมวดหมู่" }));
    await user.click(screen.getByRole("button", { name: /แก้ไขหมวดหมู่ ค่าอาหาร/ }));
    await user.click(screen.getByRole("button", { name: "ลบหมวดหมู่" }));

    expect(screen.getByRole("alert")).toHaveTextContent("ลบไม่ได้ เพราะยังมีรายการใช้หมวดหมู่นี้อยู่");
    expect(screen.getByRole("button", { name: /แก้ไขหมวดหมู่ ค่าอาหาร/ })).toBeInTheDocument();
  });
});
