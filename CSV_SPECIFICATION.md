# CSV Import Specification

## Overview
This document defines the CSV format expected by the Oath Research Peptide Inventory System.

## File Requirements

- **Format**: CSV (Comma-Separated Values)
- **Encoding**: UTF-8
- **Headers**: First row must contain column headers
- **Delimiter**: Comma (`,`)
- **Quote Character**: Double quote (`"`) for fields containing commas or newlines

## Required Columns

The system will attempt to match these fields using flexible header matching (case-insensitive):

### Peptide ID (Required)
- **Accepted Headers**: `Peptide ID`, `ID`, `Item ID`, `Product ID`, `SKU`
- **Description**: Unique identifier for the peptide
- **Format**: Text/alphanumeric
- **Example**: `PT-001`, `BPC157`, `PEPTIDE-123`

### Peptide Name (Recommended)
- **Accepted Headers**: `Peptide Name`, `Name`, `Product Name`, `Item Name`, `Description`
- **Description**: Common or chemical name of the peptide
- **Format**: Text
- **Example**: `BPC-157`, `Thymosin Beta-4`, `Melanotan II`

### Quantity (Required)
- **Accepted Headers**: `Quantity`, `Qty`, `On Hand`, `Stock`, `Available`, `Amount`
- **Description**: Amount of peptide in stock
- **Format**: Numeric (integer or decimal)
- **Example**: `150`, `250.5`, `0`

## Optional Columns

### Unit
- **Accepted Headers**: `Unit`, `UOM`, `Unit of Measure`
- **Description**: Unit of measurement for quantity
- **Format**: Text
- **Default**: `mg`
- **Example**: `mg`, `g`, `vials`

### Category
- **Accepted Headers**: `Category`, `Type`, `Class`, `Group`
- **Description**: Peptide classification or grouping
- **Format**: Text
- **Example**: `Healing`, `Growth`, `Cosmetic`, `Research`

### Supplier
- **Accepted Headers**: `Supplier`, `Vendor`, `Manufacturer`, `Lab`
- **Description**: Source of the peptide
- **Format**: Text
- **Example**: `Lab A`, `XYZ Pharma`, `Research Labs Inc`

### Location
- **Accepted Headers**: `Location`, `Warehouse`, `Storage`, `Bin`
- **Description**: Physical storage location
- **Format**: Text
- **Example**: `Freezer A`, `Shelf 3B`, `Cold Storage 1`

## Sample CSV Format

### Minimal Example
```csv
Peptide ID,Peptide Name,Quantity
PT-001,BPC-157,150
PT-002,TB-500,200
PT-003,Melanotan II,100
```

### Complete Example
```csv
Peptide ID,Peptide Name,Quantity,Unit,Category,Supplier,Location
PT-001,BPC-157,150,mg,Healing,Lab A,Freezer A
PT-002,TB-500,200,mg,Healing,Lab A,Freezer A
PT-003,Melanotan II,100,mg,Cosmetic,Lab B,Freezer B
PT-004,Ipamorelin,250,mg,Growth,Lab C,Shelf 3B
PT-005,CJC-1295,75,mg,Growth,Lab C,Shelf 3B
```

## Validation Rules

The system will validate the following:

1. **Peptide ID**:
   - Must be present for each row
   - Must be unique (duplicates will be updated, not added)
   - Cannot be empty

2. **Quantity**:
   - Must be numeric
   - Cannot be negative
   - Defaults to 0 if missing

3. **Data Types**:
   - Quantity fields must be parseable as numbers
   - All other fields are treated as text

## Import Behavior

### Duplicate IDs
If a peptide ID already exists in the system:
- The existing record will be **updated** with new values
- Previous values will be overwritten
- Timestamp will be updated

### Missing Fields
- Required fields that are missing will cause row to be skipped
- Optional fields that are missing will be omitted from the record
- A summary of skipped rows will be shown after import

### Data Transformation
- Numeric values with currency symbols, commas, or other non-numeric characters will be cleaned automatically
- Leading and trailing whitespace will be trimmed from all fields
- Empty strings will be treated as null/undefined

## Error Handling

The system will report:
- Number of rows successfully imported
- Number of rows skipped (with reasons)
- List of validation errors encountered
- Warnings for missing recommended fields

## Export Format

When exporting data from the system, the CSV will include all fields in this order:
1. Peptide ID
2. Peptide Name
3. Quantity
4. Unit
5. Category
6. Supplier
7. Location

## Testing Your CSV

Before importing:
1. Ensure headers are in the first row
2. Verify all Peptide IDs are unique
3. Check that quantity values are numeric
4. Confirm file encoding is UTF-8
5. Test with a small sample first (5-10 rows)

## Common Issues

### Issue: "No peptide data found"
- **Cause**: CSV has no valid data rows or headers don't match
- **Solution**: Verify headers match accepted names (case-insensitive)

### Issue: "Missing Peptide ID"
- **Cause**: Required Peptide ID column not found or has empty values
- **Solution**: Add a column with one of the accepted ID headers

### Issue: "Quantity must be a number"
- **Cause**: Quantity field contains non-numeric text
- **Solution**: Remove text from quantity field, keep only numbers

## Future Enhancements

Planned additions to CSV import:
- Batch number import
- Testing results import
- Order history import
- Multi-file import for related data
