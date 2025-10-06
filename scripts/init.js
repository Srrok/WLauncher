//Библиотеки
import { createInterface } from "readline"
import { exec } from "child_process"

//Создание интерфейса чтения строки
const readline = createInterface({input: process.stdin, output: process.stdout})

//Задаём вопрос по коммиту
readline.question("Введите репозиторий GitHub: ", (message) => {
  //Получаем команду
  const command = `npm i && git init && git remote add origin ${message} && git branch -m main && git checkout -b main && cargo install cargo-binstall && cargo binstall tauri-cli && npm install -g @tauri-apps/cli && cargo install tauri-cli`
  //При вызове команды
  exec(command, (error, stdout) => {
    //Если ошибка
    if (error) {
      //Логируем ошибку
      console.error(`Error: ${error.message}`)
    } else {
      //Логируем ответ
      console.log(stdout)
    }
    //Закрываем процесс
    readline.close()
  })
})