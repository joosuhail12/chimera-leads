export type CustomFieldValueRow = {
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_json: unknown;
};

export function formatCustomFieldValue(row: CustomFieldValueRow) {
  if (row.value_text) return row.value_text;
  if (row.value_number !== null && row.value_number !== undefined) {
    return row.value_number.toString();
  }
  if (row.value_boolean !== null && row.value_boolean !== undefined) {
    return row.value_boolean ? "True" : "False";
  }
  if (row.value_date) {
    return new Date(row.value_date).toLocaleDateString();
  }
  if (row.value_json) {
    if (Array.isArray(row.value_json)) {
      return row.value_json.join(", ");
    }
    return JSON.stringify(row.value_json);
  }
  return "—";
}
