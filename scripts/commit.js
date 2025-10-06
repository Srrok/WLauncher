//Библиотеки
import { createInterface } from "readline"
import { exec } from "child_process"

//Создание интерфейса чтения строки
const readline = createInterface({input: process.stdin, output: process.stdout})

//Задаём вопрос по коммиту
readline.question("Введите комментарий: ", (message) => {
  //Задаём вопрос по ветке
  readline.question("Введите ветку (по умолчанию main): ", (branch) => {
    //Перезадаём ветку
    branch = branch.trim() || "main"
    //Получаем команду
    const command = `${branch === "main" ? "" : "git branch -m main && "}git add . && git commit -m "${message}" && git push origin ${branch} --force`
    //При вызове команды
    exec(command, (error, stdout) => {
      //Если ошибка
      if (error) {
        //Логируем ошибку
        console.error(`Ошибка: ${error.message}`)
      } else {
        //Логируем ответ
        console.log(stdout)
      }
      //Закрываем процесс
      readline.close()
    })
  })
})