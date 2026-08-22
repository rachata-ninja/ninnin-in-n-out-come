# NinJahMajod Google Gemini & Mobile Voice Setup

This guide explains how to connect **Google Gemini** and **"OK Google"** on your mobile phone to NinJahMajod using the `/api/mcp` endpoint deployed on Vercel.

---

## 1. Multi-User Authentication

NinJahMajod supports multiple users on the same deployed app. Each user can connect their own Gemini or Google Assistant so their transactions only save to their own account:

### Finding Your Personal MCP URL
1. Log into your NinJahMajod account on the web.
2. Go to the **Settings (ตั้งค่า)** page.
3. Under **Google Gemini & Voice MCP**, tap **"คัดลอก MCP URL"**.
4. Your personalized URL looks like:
   ```
   https://<your-vercel-domain>.vercel.app/api/mcp?email=your_email@example.com
   ```

### Authentication Methods Supported
| Method | URL / Header Format | Best For |
|---|---|---|
| **URL Query Parameters** | `https://<domain>/api/mcp?email=user@email.com&password=yourpassword` | Quick mobile routines / Google Assistant Webhooks |
| **Bearer JWT Token** | `Authorization: Bearer <supabase_access_token>` or `?token=<token>` | Gemini MCP Clients / Antigravity |
| **Server Fallback** | `SUPABASE_USER_EMAIL` & `SUPABASE_USER_PASSWORD` in Vercel env | Single-user personal deployments |

---

## 2. Server Environment Variables on Vercel

In your **Vercel Project Settings > Environment Variables**, ensure the baseline Supabase connection variables are set:

| Variable Name | Description | Example |
|---|---|---|
| `SUPABASE_URL` | Your Supabase Project URL | `https://xyzcompany.supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase anon public key | `eyJhbGciOi...` |

---

## 3. Testing Your Vercel MCP Endpoint

You can test that your endpoint is live by opening:
```
https://<your-vercel-domain>.vercel.app/api/mcp
```
You should see a JSON response listing all available tools:
- `record_transaction`
- `get_financial_summary`
- `list_recent_transactions`
- `list_categories`
- `delete_transaction`

---

## 4. How to Connect Google Gemini & "OK Google" on Mobile

### Option A: Google Assistant Routine ("OK Google, I paid 60 baht for food")

1. Open the **Google Assistant** or **Google Home** app on your phone.
2. Go to **Settings > Routines** and tap **+ Add a Routine**.
3. **Starter (Voice trigger)**:
   - *"I spent $ for $"* or *"Paid $ on $"* or *"จดรายจ่าย $"*
4. **Action (Call Webhook)**:
   - URL: `https://<your-vercel-domain>.vercel.app/api/mcp?email=your_email@example.com&password=your_password`
   - Method: `POST`
   - Headers: `Content-Type: application/json`
   - Body:
     ```json
     {
       "tool": "record_transaction",
       "args": {
         "amount": "$1",
         "note": "$2"
       }
     }
     ```

---

### Option B: Google Gemini Custom Gem / Extension

In Google Gemini (Mobile app or Web):
1. Create or configure a Custom Gem with MCP / Function Calling enabled.
2. Provide your personalized serverless endpoint:
   - **MCP Server URL**: `https://<your-vercel-domain>.vercel.app/api/mcp?email=your_email@example.com&password=your_password`
   - **Transport**: HTTP / Server-Sent Events (SSE)
3. You can now talk to Gemini naturally:
   - *"I paid 60 baht for lunch"*
   - *"กาแฟสตาร์บัคส์ 165 บาท"*
   - *"What is my remaining food budget this month?"*
   - *"สรุปยอดใช้จ่ายเดือนนี้ให้หน่อย"*

---

### Option C: Antigravity / Claude Desktop / Local Gemini CLI

Add the following to your MCP configuration:

```json
{
  "mcpServers": {
    "ninjahmajod": {
      "url": "https://<your-vercel-domain>.vercel.app/api/mcp?email=your_email@example.com&password=your_password"
    }
  }
}
```

---

## 5. Voice Examples Supported

| What you say | Detected Category | Action Taken |
|---|---|---|
| *"Paid food for 60 baht"* | `ค่าอาหาร` (Food) | Records 60 THB expense |
| *"กาแฟสตาร์บัคส์ 150 บาท"* | `ค่าอาหาร` / `เซเว่น` | Records 150 THB expense |
| *"นั่งบีทีเอสไปสยาม 45 บาท"* | `เดินทาง` (Transport) | Records 45 THB expense |
| *"เซเว่น 85 บาท ซื้อขนม"* | `เซเว่น` (7-Eleven) | Records 85 THB expense |
| *"เงินเดือนเข้า 45000 บาท"* | `เงินเดือน` (Salary) | Records 45,000 THB income |
| *"สรุปยอดใช้จ่ายเดือนนี้"* | Summary tool | Returns income, expense, balance & budgets |
