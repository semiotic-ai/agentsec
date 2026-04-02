declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
