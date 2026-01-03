/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'zeus-dark': '#0a0a0a',
                'zeus-panel': '#1a1a1a',
                'zeus-accent': '#3b82f6',
                'zeus-alert': '#ef4444',
            }
        },
    },
    plugins: [],
}
