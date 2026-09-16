import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
	base: "/moddable-m5chain/",
	build: {
		rollupOptions: {
			input: {
				index: fileURLToPath(new URL("index.html", import.meta.url)),
				buzzer: fileURLToPath(new URL("buzzer/index.html", import.meta.url)),
				matrix: fileURLToPath(new URL("matrix/index.html", import.meta.url)),
			},
		},
	},
});
