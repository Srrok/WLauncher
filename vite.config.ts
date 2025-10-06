//Библиотеки
import mkcert from "vite-plugin-mkcert"
import { config as env } from "dotenv"
import solid from "vite-plugin-solid"
import { defineConfig } from "vite"

//Получаем порт интерфейса
const port = (() => {try {
  //Подключаем конфигурацию
  env({debug: false, quiet: true})
  //Возвращаем ответ
  return process.env.WEB_PORT ? parseInt(process.env.WEB_PORT) : 1420
} catch(e) {return 1420}})()

//Конфигурация проекта
export default defineConfig({
  plugins: [solid(), mkcert()],
  envPrefix: ["PUBLIC_"],
  clearScreen: false,
  server: {
    https: {},
    strictPort: true,
    hmr: process.env.DEV_HOST ? {
      host: process.env.DEV_HOST,
      protocol: "ws",
      port: port + 1,
    } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"]
    },
    host: true,
    port,
  },
  resolve: {
    alias: {
      "@": "./src/",
      "@styles": "./styles/",
      "@public": "./public/",
      "@routes": "./routes/",
      "@components": "./components/",
    }
  }
})