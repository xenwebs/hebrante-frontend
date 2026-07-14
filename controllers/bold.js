// ==================== BACKEND EXAMPLE (Node.js / Strapi) ====================
// Это файл для твоего бэкенда - НЕ в frontend!

// Файл: routes/bold-webhook.js или controllers/bold.js

import fetch from "node-fetch"

// 🔑 BOLD API CONFIGURATION - ТОЛЬКО НА БЭКЕНДЕ!
const ENV = process.env.NODE_ENV || "development"
const isProduction = ENV === "production"

const BOLD_CONFIG = {
  // Для BACKEND нужны SECRET KEY и ACCOUNT ID!
  SECRET_KEY: isProduction 
    ? process.env.BOLD_SECRET_KEY_PROD    // sk_live_...
    : process.env.BOLD_SECRET_KEY_TEST,   // sk_test_...
  
  ACCOUNT_ID: isProduction
    ? process.env.BOLD_ACCOUNT_ID_PROD    // acc_live_...
    : process.env.BOLD_ACCOUNT_ID_TEST,   // acc_test_...
  
  API_URL: isProduction 
    ? "https://api.bold.co/v1"
    : "https://api-sandbox.bold.co/v1"
}

console.log(`🔧 Bold Backend configured for: ${isProduction ? "PRODUCTION" : "SANDBOX"}`)

// ==================== WEBHOOK ENDPOINT ====================

/**
 * POST /api/bold-webhook
 * Получение подтверждения платежа от Bold
 */
export async function handleBoldWebhook(req, res) {
  try {
    const { orderId, status, transactionId, amount } = req.body

    console.log("🔔 Bold webhook получен:", { orderId, status, transactionId, amount })

    // 1. Проверить подпись (для безопасности)
    const isValid = await verifyBoldSignature(req)
    if (!isValid) {
      console.error("❌ Неверная подпись Bold")
      return res.status(401).json({ error: "Invalid signature" })
    }

    // 2. Обновить заказ в БД
    const order = await updateOrderStatus(orderId, status, transactionId)

    // 3. Отправить подтверждение Bold
    res.json({ 
      success: true,
      message: "Order updated successfully",
      orderId: orderId
    })

  } catch (error) {
    console.error("❌ Bold webhook error:", error)
    res.status(500).json({ error: error.message })
  }
}

// ==================== VERIFY PAYMENT ====================

/**
 * Проверить платеж у Bold
 */
export async function verifyPayment(transactionId) {
  try {
    const response = await fetch(
      `${BOLD_CONFIG.API_URL}/transactions/${transactionId}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${BOLD_CONFIG.SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Bold API error: ${response.status}`)
    }

    const data = await response.json()
    console.log("✅ Платеж проверен:", data)
    return data

  } catch (error) {
    console.error("❌ Payment verification error:", error)
    throw error
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Проверить подпись вебхука от Bold (для безопасности)
 */
async function verifyBoldSignature(req) {
  try {
    // Bold отправляет подпись в заголовке
    const signature = req.headers["x-bold-signature"]
    
    if (!signature) {
      console.warn("⚠️ No Bold signature found")
      return false
    }

    // Проверить подпись с помощью SECRET KEY
    // (Точный алгоритм проверь в документации Bold)
    const crypto = await import("crypto")
    const body = JSON.stringify(req.body)
    const hash = crypto
      .createHmac("sha256", BOLD_CONFIG.SECRET_KEY)
      .update(body)
      .digest("hex")

    return signature === hash

  } catch (error) {
    console.error("❌ Signature verification error:", error)
    return false
  }
}

/**
 * Обновить статус заказа в БД
 */
async function updateOrderStatus(orderId, status, transactionId) {
  try {
    // Если используешь Strapi:
    const response = await fetch(`http://localhost:1337/api/orders/${orderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          status: status === "approved" ? "paid" : "failed",
          paymentId: transactionId,
          paymentMethod: "bold",
          paymentStatus: status,
          paidAt: status === "approved" ? new Date().toISOString() : null
        }
      })
    })

    if (!response.ok) { throw new Error("Failed to update order")
    }

    const updatedOrder = await response.json()
    console.log("✅ Заказ обновлён:", updatedOrder)
    return updatedOrder

  } catch (error) {
    console.error("❌ Update order error:", error)
    throw error
  }
}

// ==================== CREATE PAYMENT (Optional) ====================

/**
 * Создать платеж через Bold API (если нужно)
 * Можно использовать вместо открытия модала
 */
export async function createPaymentWithBold(orderData) {
  try {
    const paymentPayload = {
      account_id: BOLD_CONFIG.ACCOUNT_ID,
      amount: orderData.total,
      currency: "COP",
      description: `Order #${orderData.orderId}`,
      customer: {
        email: orderData.email,
        phone: orderData.phone,
        name: orderData.customerName
      },
      metadata: {
        orderId: orderData.orderId,
        shippingAddress: orderData.address
      }
    }

    const response = await fetch(`${BOLD_CONFIG.API_URL}/payments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${BOLD_CONFIG.SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(paymentPayload)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || "Payment creation failed")
    }

    const payment = await response.json()
    console.log("✅ Платеж создан в Bold:", payment)
    return payment

  } catch (error) {
    console.error("❌ Create payment error:", error)
    throw error
  }
}

// ==================== EXPRESS ROUTE EXAMPLE ====================

/**
 * Пример регистрации маршрута в Express:
 * 
 * import express from "express"
 * import { handleBoldWebhook, verifyPayment } from "./bold-controller.js"
 * 
 * const router = express.Router()
 * 
 * router.post("/api/bold-webhook", handleBoldWebhook)
 * router.get("/api/verify-payment/:transactionId", verifyPayment)
 * 
 * export default router
 */