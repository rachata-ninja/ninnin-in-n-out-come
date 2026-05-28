import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { STORAGE_KEY } from "./storage/appStorage";

describe("App smoke flow", () => {
  beforeEach(() => {
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
});
