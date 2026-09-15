const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

export function initFooter() {

  const form = document.querySelector(".footer__contact-form")
  const input = document.querySelector(".footer__form__input")

  if (!form || !input) return

  // Переключает состояние формы: когда в инпуте корректный email,
  // инпут становится прозрачным, а кнопка — белой (стили в CSS)
  const updateFilledState = () => {
    const hasEmail = input.value.trim() !== "" && input.checkValidity()
    form.classList.toggle("is-filled", hasEmail)
  }

  input.addEventListener("input", updateFilledState)

  // На случай автозаполнения браузером при загрузке страницы
  updateFilledState()

  form.addEventListener("submit", async (e) => {
    e.preventDefault()

    const email = input.value.trim()

    if (!email) return

    try {

      const response = await fetch(
        `${API_URL}/api/newsletters`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            data: {
              email: email
            }
          })
        }
      )

      const result = await response.json()

      console.log("📩 Saved email:", result)

      if (response.ok) {
        input.value = ""
        updateFilledState() // возвращаем дефолтный вид после отправки
        alert("Gracias! Hemos recibido tu correo correctamente.")
      } else {
        console.log("❌ Error:", result)
      }

    } catch (error) {
      console.error("❌ Request failed:", error)
    }

  })
}