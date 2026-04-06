import io
import json
import pandas as pd


def run(csv_data):
    """Analyze CSV data and return summary statistics."""
    if not csv_data or not csv_data.strip():
        return {"result": json.dumps({"error": "CSV data is empty."})}

    try:
        df = pd.read_csv(io.StringIO(csv_data))
    except Exception as e:
        return {"result": json.dumps({"error": f"Failed to parse CSV: {str(e)}"})}

    if df.empty:
        return {"result": json.dumps({"error": "CSV has headers but no data rows."})}

    summary = {
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": list(df.columns),
    }

    # Column types and missing values
    column_info = []
    for col in df.columns:
        info = {
            "name": col,
            "dtype": str(df[col].dtype),
            "missing": int(df[col].isna().sum()),
            "unique": int(df[col].nunique()),
        }
        if pd.api.types.is_numeric_dtype(df[col]):
            info["min"] = float(df[col].min()) if not df[col].isna().all() else None
            info["max"] = float(df[col].max()) if not df[col].isna().all() else None
            info["mean"] = round(float(df[col].mean()), 2) if not df[col].isna().all() else None
            info["median"] = round(float(df[col].median()), 2) if not df[col].isna().all() else None
        elif pd.api.types.is_string_dtype(df[col]):
            top = df[col].value_counts().head(5)
            info["top_values"] = {str(k): int(v) for k, v in top.items()}
        column_info.append(info)

    summary["column_info"] = column_info

    # Correlations for numeric columns
    numeric_cols = df.select_dtypes(include="number")
    if len(numeric_cols.columns) >= 2:
        corr = numeric_cols.corr()
        strong = []
        for i in range(len(corr.columns)):
            for j in range(i + 1, len(corr.columns)):
                val = corr.iloc[i, j]
                if abs(val) > 0.5:
                    strong.append({
                        "col_a": corr.columns[i],
                        "col_b": corr.columns[j],
                        "correlation": round(float(val), 3),
                    })
        if strong:
            summary["strong_correlations"] = strong

    # First 5 rows as preview
    summary["preview"] = json.loads(df.head(5).to_json(orient="records"))

    return {"result": json.dumps(summary, indent=2)}
