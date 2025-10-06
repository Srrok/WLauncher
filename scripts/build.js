//Библиотеки
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs"
import { createInterface } from "readline"
import { execSync } from "child_process"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

//Получаем корневую директорию проекта
const __dirname = dirname(fileURLToPath(import.meta.url))

//Консольный интерфейс
const readline = createInterface({input: process.stdin, output: process.stdout})

//Функция вопроса к пользователю
const question = (query) => new Promise(resolve => readline.question(query, resolve))

//Получаем аргументы команды
const args = process.argv.slice(2).join(" ")

//Если ответ на вопрос о сертификатах отрицательный
if ((await question("Установить сертификаты автообновления? (Y/n): ") || "y").toLowerCase() === "n") {
  //Информируем пользователя
  console.log("Пропускаем настройку сертификатов...")
  //Вызываем команду сборки приложения
  execSync(`npm run tauri build ${args}`, {stdio: "inherit"})
  //Закрываем CLI интерфейс
  readline.close()
  //Возвращаем ответ
  return undefined
}

try {
  //Информируем пользователя
  console.log("Генерация ключей подписи...")
  //Получаем пароль от пользователя
  const password = await question("Пароль для ключа (Enter для отсутствия пароля): ")
  //Вызываем сборку ключей для Tauri
  execSync(`cargo tauri signer generate -w ./.tauri/wlauncher.key${password ? ` -p "${password}"` : ""}`, {stdio: "inherit"})
  //Получаем информацию о репозитории
  let repoUrl = (async (def = "https://github.com/Srrok/WLauncher") => {try {
    //Получаем URL привязанного репозитория
    return execSync("git remote get-url origin")?.toString()?.trim()?.replace(/\.git$/, "")?.replace("git@github.com:", "https://github.com/") ?? def
  } catch {
    //Получаем URL репозитория от пользователя
    return await question(`Git репозиторий не найден. Введите эндпоинт (по умолчанию ${def}): `) ?? def
  }})()
  //Информирование пользователя
  console.log("Обновление tauri.conf.json...")
  //Получаем конфигурационный файл
  const config = JSON.parse(readFileSync(join(__dirname, "src-tauri", "tauri.conf.json"), "utf8"))
  //Редактируем конфигурацию
  config.tauri = config.tauri || {}
  config.tauri.plugins = config.tauri.plugins || {}
  config.tauri.plugins.updater = {
    createUpdaterArtifacts: true,
    endpoints: [`https://raw.githubusercontent.com/${repoUrl.split('/').slice(-2).join('/')}/main/latest.json`],
    pubkey: readFileSync("./.tauri/wlauncher.key.pub", "utf8").trim()
  }
  //Записываем новую конфигурацию в файл
  writeFileSync(join(__dirname, "src-tauri", "tauri.conf.json"), JSON.stringify(config, null, 2))
  //Информируем пользователя
  console.log("Установка переменных окружения и сборка...")
  //Получаем контент приватного ключа и записываем в процесс
  process.env.TAURI_SIGNING_PRIVATE_KEY = readFileSync("./.tauri/wlauncher.key", "utf8")
  //Если есть пароль - вносим в процесс
  if (password) process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = password
  //Собираем конечную программу с аргументами
  execSync(`npm run tauri build ${args}`, {stdio: "inherit"})
  //Информируем пользователя
  console.log("Создание latest.json...")
  //Если файл существует - удаляем файл
  if (existsSync("./latest.json")) unlinkSync("./latest.json")
  //Получаем комментарий к обновлению
  const note = await question(`Введите комментарий к обновлению (по умолчанию «Очередное обновление»): `) ?? "Очередное обновление"
  //Записываем шаблон нового файла о новой версии
  writeFileSync("./latest.json", JSON.stringify({
    version: tauri.version.startsWith("v") ? tauri.version : `v${tauri.version}`,
    notes: note,
    pub_date: new Date().toISOString().split('.')[0] + "Z",
    platforms: {
      "darwin-x86_64": {
        signature: "Содержимое файла wlauncher.app.tar.gz.sig",
        url: `${repoUrl}/releases/download/v1.0.0/wlauncher-x86_64.app.tar.gz`
      },
      "darwin-aarch64": {
        signature: "Содержимое файла wlauncher.app.tar.gz.sig", 
        url: `${repoUrl}/releases/download/v1.0.0/wlauncher-aarch64.app.tar.gz`
      },
      "linux-x86_64": {
        signature: "Содержимое файла wlauncher.AppImage.tar.gz.sig",
        url: `${repoUrl}/releases/download/v1.0.0/wlauncher-amd64.AppImage.tar.gz`
      },
      "windows-x86_64": {
        signature: "Содержимое файла wlauncher-setup.nsis.zip.sig",
        url: `${repoUrl}/releases/download/v1.0.0/wlauncher-x64-setup.nsis.zip`
      }
    }
  }, null, 2))
  //Информируем пользователя
  console.log("\n⚠️  ВНИМАНИЕ: Поля «signature» в «latest.json» файле в корне проекта нужно заполнить вручную после создания подписей!")
  console.log("📁 Файл latest.json создан в корне проекта")
} catch (error) {
  //Выбрасываем ошибку
  console.error("Ошибка:", error.message)
}

//Закрываем консоль
readline.close()