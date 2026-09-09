// Side-effect imports of stylesheets (e.g. `import "@/global.css"`) carry no
// runtime value, but TypeScript 6 still requires a declaration for them.
declare module "*.css";
