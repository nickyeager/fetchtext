-- Add Receipt Parser template for retail receipt processing
-- This migration adds a comprehensive receipt template for extracting data from retail receipts

INSERT INTO smart_templates (
    name, description, template_content, template_type, category, tags, 
    is_public, usage_count, rating, smart_variables, 
    extraction_rules, generation_settings
) 
SELECT * FROM (VALUES 
    -- Receipt Parser Template
    (
        'Receipt Parser',
        'Extract key information from retail receipts including merchant details, items purchased, payment information, and totals',
        '# Receipt Summary

**Store:** {merchant_name}
**Location:** {store_address}
**Phone:** {store_phone}

## Transaction Details
**Receipt #:** {receipt_number}
**Date:** {transaction_date}
**Time:** {transaction_time}
**Cashier:** {cashier_name}
**Register:** {register_number}

## Payment Information
**Payment Method:** {payment_method}
**Card Type:** {card_type}
**Card Last 4:** {card_last_four}
**Authorization:** {auth_code}

## Purchase Summary
**Items Purchased:** {items_description}
**Quantity:** {total_quantity}
**Subtotal:** {subtotal}
**Tax:** {tax_amount}
**Discount:** {discount_amount}
**Total:** {total_amount}

## Additional Information
**Cashback:** {cashback_amount}
**Change:** {change_given}
**Loyalty Points:** {loyalty_points}
**Survey Code:** {survey_code}
**Return Policy:** {return_policy_days}',
        'markdown',
        'Retail',
        ARRAY['receipt', 'retail', 'transaction', 'purchase', 'pos', 'sales'],
        true,
        0,
        4.7,
        '[
            {"id": "merchant_name", "name": "merchant_name", "type": "text", "description": "Name of the store or merchant", "extraction_hints": ["store name", "merchant", "business name", "retailer", "shop"], "default_value": ""},
            {"id": "store_address", "name": "store_address", "type": "text", "description": "Store address or location", "extraction_hints": ["address", "location", "store address", "street", "city"], "default_value": ""},
            {"id": "store_phone", "name": "store_phone", "type": "text", "description": "Store phone number", "extraction_hints": ["phone", "telephone", "tel", "contact", "store phone"], "default_value": ""},
            {"id": "receipt_number", "name": "receipt_number", "type": "text", "description": "Receipt or transaction number", "extraction_hints": ["receipt", "receipt #", "transaction #", "ref", "reference number"], "default_value": ""},
            {"id": "transaction_date", "name": "transaction_date", "type": "date", "description": "Date of the transaction", "extraction_hints": ["date", "transaction date", "purchase date", "sale date"], "default_value": ""},
            {"id": "transaction_time", "name": "transaction_time", "type": "text", "description": "Time of the transaction", "extraction_hints": ["time", "transaction time", "purchase time", "AM", "PM"], "default_value": ""},
            {"id": "cashier_name", "name": "cashier_name", "type": "text", "description": "Name or ID of the cashier", "extraction_hints": ["cashier", "server", "associate", "operator", "clerk"], "default_value": ""},
            {"id": "register_number", "name": "register_number", "type": "text", "description": "Register or terminal number", "extraction_hints": ["register", "terminal", "POS", "station"], "default_value": ""},
            {"id": "payment_method", "name": "payment_method", "type": "text", "description": "Payment method used", "extraction_hints": ["payment", "cash", "card", "credit", "debit", "mobile pay"], "default_value": ""},
            {"id": "card_type", "name": "card_type", "type": "text", "description": "Type of card used (Visa, Mastercard, etc.)", "extraction_hints": ["visa", "mastercard", "amex", "discover", "card type"], "default_value": ""},
            {"id": "card_last_four", "name": "card_last_four", "type": "text", "description": "Last 4 digits of card number", "extraction_hints": ["ending", "last 4", "xxxx", "****", "card ending"], "default_value": ""},
            {"id": "auth_code", "name": "auth_code", "type": "text", "description": "Authorization code for card transaction", "extraction_hints": ["auth", "authorization", "approval", "auth code"], "default_value": ""},
            {"id": "items_description", "name": "items_description", "type": "text", "description": "Description of items purchased", "extraction_hints": ["items", "products", "merchandise", "description", "purchased"], "default_value": ""},
            {"id": "total_quantity", "name": "total_quantity", "type": "number", "description": "Total number of items", "extraction_hints": ["quantity", "qty", "items", "count", "total items"], "default_value": ""},
            {"id": "subtotal", "name": "subtotal", "type": "currency", "description": "Subtotal before tax and discounts", "extraction_hints": ["subtotal", "sub total", "before tax", "pre-tax"], "default_value": ""},
            {"id": "tax_amount", "name": "tax_amount", "type": "currency", "description": "Tax amount charged", "extraction_hints": ["tax", "sales tax", "VAT", "GST", "tax amount"], "default_value": ""},
            {"id": "discount_amount", "name": "discount_amount", "type": "currency", "description": "Total discount amount", "extraction_hints": ["discount", "savings", "off", "coupon", "promotion"], "default_value": ""},
            {"id": "total_amount", "name": "total_amount", "type": "currency", "description": "Final total amount paid", "extraction_hints": ["total", "amount", "grand total", "final total", "paid"], "default_value": ""},
            {"id": "cashback_amount", "name": "cashback_amount", "type": "currency", "description": "Cashback amount received", "extraction_hints": ["cashback", "cash back", "cash out", "withdrawal"], "default_value": ""},
            {"id": "change_given", "name": "change_given", "type": "currency", "description": "Change given to customer", "extraction_hints": ["change", "change due", "change given", "returned"], "default_value": ""},
            {"id": "loyalty_points", "name": "loyalty_points", "type": "number", "description": "Loyalty points earned or used", "extraction_hints": ["points", "loyalty", "rewards", "earned", "used"], "default_value": ""},
            {"id": "survey_code", "name": "survey_code", "type": "text", "description": "Customer survey code", "extraction_hints": ["survey", "survey code", "feedback", "review code"], "default_value": ""},
            {"id": "return_policy_days", "name": "return_policy_days", "type": "number", "description": "Number of days for return policy", "extraction_hints": ["return", "return policy", "days", "exchange", "refund"], "default_value": ""}
        ]'::jsonb,
        '[]'::jsonb,
        '{}'::jsonb
    )
) AS template_data(name, description, template_content, template_type, category, tags, is_public, usage_count, rating, smart_variables, extraction_rules, generation_settings)
WHERE NOT EXISTS (
    SELECT 1 FROM smart_templates WHERE smart_templates.name = template_data.name
);
