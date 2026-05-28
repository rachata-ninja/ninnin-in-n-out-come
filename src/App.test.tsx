import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { defaultAppData } from "./data/defaultData";
import { STORAGE_KEY } from "./storage/appStorage";

describe("App smoke flow", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    window.localStorage.clear();
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
    await user.selectOptions(
      screen.getByLabelText("หมวดหมู่"),
      screen.getByRole("option", { name: "กาแฟ" }),
    );
    await user.type(screen.getByLabelText("จำนวนเงิน"), "85");
    await user.clear(screen.getByLabelText("วันที่"));
    await user.type(screen.getByLabelText("วันที่"), "2026-05-10");
    await user.type(screen.getByLabelText("โน้ต"), "ลาเต้");
    await user.click(screen.getByRole("button", { name: "เพิ่มรายการ" }));

    const table = screen.getByRole("table");
    expect(within(table).getByText("กาแฟ")).toBeInTheDocument();
    expect(within(table).getByText("ลาเต้")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dashboard" }));
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
    await user.selectOptions(screen.getByLabelText("หมวดหมู่"), screen.getByRole("option", { name: "เงินออม" }));
    await user.type(screen.getByLabelText("จำนวนเงิน"), "2500");
    await user.clear(screen.getByLabelText("วันที่"));
    await user.type(screen.getByLabelText("วันที่"), "2026-05-05");
    await user.type(screen.getByLabelText("โน้ต"), "เงินสำรอง");
    await user.click(screen.getByRole("button", { name: "เพิ่มรายการ" }));

    expect(screen.getByText("เงินสำรอง")).toBeInTheDocument();
    expect(screen.getAllByText("ออมเงิน").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Dashboard" }));
    await user.clear(screen.getByLabelText("ปี"));
    await user.type(screen.getByLabelText("ปี"), "2026");
    await user.selectOptions(screen.getByLabelText("เดือน"), "5");

    expect(screen.getByText("ออมเงินทั้งหมด")).toBeInTheDocument();
    expect(screen.getAllByText("฿2,500").length).toBeGreaterThan(0);
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

  it("requires confirmation before resetting demo data", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "รายการ" }));
    await user.selectOptions(screen.getByLabelText("หมวดหมู่"), screen.getByRole("option", { name: "ค่าอาหาร" }));
    await user.type(screen.getByLabelText("จำนวนเงิน"), "42");
    await user.type(screen.getByLabelText("โน้ต"), "ทดสอบ reset");
    await user.click(screen.getByRole("button", { name: "เพิ่มรายการ" }));
    expect(screen.getByText("ทดสอบ reset")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await user.click(screen.getByRole("button", { name: "รายการ" }));
    expect(screen.getByText("ทดสอบ reset")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await user.click(screen.getByRole("button", { name: "ยืนยัน Reset" }));
    await user.click(screen.getByRole("button", { name: "รายการ" }));
    expect(screen.queryByText("ทดสอบ reset")).not.toBeInTheDocument();
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
