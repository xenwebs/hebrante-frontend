

export function initSizeHelper(productData) {
    console.log("🔍 Данные продукта:", productData)
  console.log("📏 Размеры:", productData.sizes)
  console.log("🎨 Коэффициенты:", productData.fitCoefficients)

  // ✅ ПРОВЕРКА
  if (!productData.sizes || Object.keys(productData.sizes).length === 0) {
    console.error("❌ ОШИБКА: sizes пусто или не определено!")
    console.log("productData:", productData)
    return  // выход если sizes нет
  }


    const sizeBtn = document.querySelector("[data-open-size-helper]") ||
                    document.querySelector(".size-recommend")
  const modal = document.getElementById("size-helper-modal")
  const form = document.getElementById("size-form")
  const result = document.getElementById("size-result")
  const closeBtn = document.querySelector(".modal__close")
  const recalculateBtn = document.getElementById("recalculate-btn")
  const chooseSizeBtn = document.getElementById("choose-size-btn")
  
  let selectedSize = null

  // Открыть модал
  if (sizeBtn) {
    sizeBtn.addEventListener("click", () => {
      modal.classList.remove("hidden")
      form.reset()
      result.classList.add("hidden")
    })
  }

  // Закрыть модал
  closeBtn?.addEventListener("click", () => {
    modal.classList.add("hidden")
  })

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden")
    }
  })

  // Отправить форму
  form?.addEventListener("submit", (e) => {
    e.preventDefault()

    const height = parseInt(document.getElementById("height").value)
    const weight = parseInt(document.getElementById("weight").value)
    const fit = document.getElementById("fit").value

    // Подобрать размер
    selectedSize = calculateSize(height, weight, fit, productData.sizes, productData.fitCoefficients)

    // Показать результат
    displayResult(height, weight, fit, selectedSize)
    result.classList.remove("hidden")
    form.style.display = "none"
  })

  // Пересчитать
  recalculateBtn?.addEventListener("click", () => {
    form.reset()
    form.style.display = "flex"
    result.classList.add("hidden")
  })

  // Выбрать размер
  // Выбрать размер
chooseSizeBtn?.addEventListener("click", () => {
  // Найди dropdown и selected элемент
  const dropdown = document.querySelector(".size-dropdown")
  const selected = dropdown.querySelector(".size-dropdown__selected")
  
  // Обнови UI dropdown
  selected.textContent = selectedSize.toUpperCase()
  
  // Обнови внутреннее состояние (если нужно для add to cart)
  const sizeSelect = document.getElementById("size-select")
  if (sizeSelect) {
    sizeSelect.value = selectedSize
    sizeSelect.dispatchEvent(new Event("change"))
  }
  
  // Закрой модал
  modal.classList.add("hidden")
})

}

// Алгоритм подбора размера
function calculateSize(height, weight, fit, sizes, fitCoefficients) {
  const coefficient = fitCoefficients?.[fit] || {
    regular: 1.0,
    oversize: 1.15,
    slim: 0.95
  }[fit] || 1.0
   console.log("🔍 calculateSize вызвана с sizes:", sizes)
  console.log("🔍 Object.entries(sizes):", Object.entries(sizes || {}))

  console.log(`📌 Коэффициент ${fit}: ${coefficient}`)

  let bestSize = "m"
  let bestScore = Infinity
  const bmi = weight / ((height / 100) ** 2)
  console.log(`📊 BMI: ${bmi.toFixed(1)}`)

  for (const [size, sizeData] of Object.entries(sizes || {})) {
    if (!sizeData || !sizeData.height_range) {
  console.warn(`⚠️ ${size}: нет height_range, пропускаю`)
  continue
}
    const minHeight = sizeData.height_range.min
    const maxHeight = sizeData.height_range.max
    const midHeight = (minHeight + maxHeight) / 2
    
    // ✅ ИСПОЛЬЗУЙ КОЭФФИЦИЕНТ
    const adjustedWidth = sizeData.width * coefficient
    
    const heightDiff = Math.abs(height - midHeight)
    const isHeightMatch = height >= minHeight && height <= maxHeight
    
    // ✅ ГЛАВНОЕ: используй ВЕС, не BMI!
    // Примерный вес для размера в зависимости от РОСТА
    const sizeWeights = {
      xs: { min: 45, max: 55 },
      s: { min: 55, max: 65 },
      m: { min: 65, max: 75 },
      l: { min: 75, max: 85 },
      xl: { min: 85, max: 100 }
    }
    
    const expectedWeight = sizeWeights[size]
    const weightMatch = weight >= expectedWeight.min && weight <= expectedWeight.max
    const weightDiff = weightMatch ? 0 : Math.abs(weight - (expectedWeight.max + expectedWeight.min) / 2)
    
    // ✅ СЧИТАЙ СЧЕТ: рост + вес (вес важнее!)
    let finalScore = (heightDiff * 1) + (weightDiff * 2)
    
    if (!isHeightMatch) finalScore += 50
    if (!weightMatch) finalScore += 30
    
    if (isHeightMatch && weightMatch) finalScore *= 0.5  // Бонус если оба параметра совпадают

    console.log(`${size}: score=${finalScore.toFixed(1)}, height=${heightDiff}, weight=${weightDiff.toFixed(1)}, match=${isHeightMatch && weightMatch}`)

    if (finalScore < bestScore) {
      bestScore = finalScore
      bestSize = size
    }
  }

  console.log(`✅ Выбранный размер: ${bestSize}`)
  return bestSize
}


// Показать результат
function displayResult(height, weight, fit, size) {
  const fitNames = {
    regular: "Regular fit",
    oversized: "Oversize",
    slim: "Slim"
  }

  document.getElementById("result-height").textContent = height
  document.getElementById("result-weight").textContent = weight
  document.getElementById("result-fit").textContent = fitNames[fit]
  document.getElementById("recommended-size-text").textContent = size.toUpperCase()
  
  // Опционально добавь информацию о размере
}