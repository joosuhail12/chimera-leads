export function compileEmailTemplate(mjmlMarkup: string) {
  console.warn("MJML compilation is disabled. Returning raw markup.");
  return {
    html: mjmlMarkup, // Fallback
    ampHtml: "",
  };
}
