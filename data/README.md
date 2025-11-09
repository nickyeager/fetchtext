# Test Documents for Template Generation

This directory contains sample documents for testing the template generation feature.

## Document Types

1. **sample_invoice.txt** - Professional services invoice with detailed line items
2. **sample_receipt.txt** - Retail purchase receipt with tax and payment details  
3. **sample_contract.txt** - Service agreement with parties, terms, and payment schedule
4. **sample_report.txt** - Quarterly sales report with metrics and analysis
5. **sample_form.txt** - Employee information form with personal and employment data
6. **sample_letter.txt** - Legal business letter with recommendations and next steps

## Usage

These documents are designed to test different aspects of the AI template generation:

- **Field Detection**: Each document contains various field types (text, currency, dates, emails, phones)
- **Structure Recognition**: Documents have different organizational patterns
- **Data Extraction**: Sample values for testing extraction accuracy
- **Category Classification**: Documents represent common business document types

## Expected Template Fields

### Invoice
- invoice_number, date, company_name, customer_name, total_amount, email, phone

### Receipt  
- receipt_number, store_name, date, total_amount, payment_method, customer_name

### Contract
- contract_number, party_a, party_b, start_date, end_date, contract_value

### Report
- report_title, date, prepared_by, total_revenue, growth_rate, next_review_date

### Form
- employee_id, first_name, last_name, email, phone, position, start_date

### Letter
- date, recipient_name, company_name, subject, sender_name, phone, email

## Testing Instructions

1. Upload each document through the admin dashboard
2. Verify template generation is triggered when no matching templates exist
3. Review generated fields match expected extractions
4. Test template saving and application to documents
5. Validate end-to-end document processing workflow