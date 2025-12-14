-- Seed common smart templates for FetchText platform
-- This provides users with ready-to-use templates for common document processing tasks

-- Business templates
INSERT INTO smart_templates (
  name, 
  description, 
  template_content, 
  category, 
  tags, 
  is_public, 
  smart_variables,
  extraction_rules
) VALUES 
(
  'Business Card Scanner',
  'Extract contact information from business cards automatically',
  '# Contact Information\n\n**Name:** {{name}}\n**Title:** {{title}}\n**Company:** {{company}}\n**Email:** {{email}}\n**Phone:** {{phone}}\n**Address:** {{address}}',
  'business',
  ARRAY['contact', 'business-card', 'networking'],
  true,
  '[
    {"id": "name", "name": "Full Name", "type": "text", "description": "Person''s full name", "extraction_hints": ["name", "contact name", "person name"]},
    {"id": "title", "name": "Job Title", "type": "text", "description": "Professional title or position", "extraction_hints": ["title", "position", "role"]},
    {"id": "company", "name": "Company Name", "type": "text", "description": "Company or organization name", "extraction_hints": ["company", "organization", "business"]},
    {"id": "email", "name": "Email Address", "type": "text", "description": "Email contact", "extraction_hints": ["email", "e-mail", "@"]},
    {"id": "phone", "name": "Phone Number", "type": "text", "description": "Phone or mobile number", "extraction_hints": ["phone", "mobile", "tel", "call"]},
    {"id": "address", "name": "Address", "type": "text", "description": "Business address", "extraction_hints": ["address", "location", "street"]}
  ]'::jsonb,
  '[
    {"variable_id": "name", "ai_prompt": "Extract the person''s full name from this business card", "confidence_threshold": 0.8},
    {"variable_id": "email", "ai_prompt": "Find and extract the email address", "confidence_threshold": 0.9},
    {"variable_id": "phone", "ai_prompt": "Extract phone or mobile number", "confidence_threshold": 0.8}
  ]'::jsonb
),
(
  'Invoice Information Extractor',
  'Extract key financial data from invoices and bills',
  '# Invoice Summary\n\n**Invoice Number:** {{invoice_number}}\n**Date:** {{invoice_date}}\n**Due Date:** {{due_date}}\n**Vendor:** {{vendor_name}}\n**Total Amount:** {{total_amount}}\n**Tax Amount:** {{tax_amount}}\n\n## Line Items\n{{line_items}}',
  'finance',
  ARRAY['invoice', 'billing', 'accounting', 'finance'],
  true,
  '[
    {"id": "invoice_number", "name": "Invoice Number", "type": "text", "description": "Invoice or bill number", "extraction_hints": ["invoice #", "bill #", "number"]},
    {"id": "invoice_date", "name": "Invoice Date", "type": "date", "description": "Date of invoice", "extraction_hints": ["date", "invoice date", "billed date"]},
    {"id": "due_date", "name": "Due Date", "type": "date", "description": "Payment due date", "extraction_hints": ["due date", "payment due", "due"]},
    {"id": "vendor_name", "name": "Vendor Name", "type": "text", "description": "Company or vendor name", "extraction_hints": ["vendor", "from", "company", "supplier"]},
    {"id": "total_amount", "name": "Total Amount", "type": "currency", "description": "Total amount due", "extraction_hints": ["total", "amount due", "balance"]},
    {"id": "tax_amount", "name": "Tax Amount", "type": "currency", "description": "Tax amount", "extraction_hints": ["tax", "VAT", "sales tax"]},
    {"id": "line_items", "name": "Line Items", "type": "text", "description": "List of items or services", "extraction_hints": ["items", "services", "description"]}
  ]'::jsonb,
  '[
    {"variable_id": "total_amount", "ai_prompt": "Find the total amount or balance due on this invoice", "confidence_threshold": 0.9},
    {"variable_id": "invoice_number", "ai_prompt": "Extract the invoice number or reference number", "confidence_threshold": 0.8},
    {"variable_id": "vendor_name", "ai_prompt": "Identify the vendor or company name", "confidence_threshold": 0.8}
  ]'::jsonb
),
(
  'Resume/CV Parser',
  'Extract professional information from resumes and CVs',
  '# Professional Profile\n\n**Name:** {{full_name}}\n**Email:** {{email}}\n**Phone:** {{phone}}\n**Location:** {{location}}\n\n## Experience\n{{experience}}\n\n## Education\n{{education}}\n\n## Skills\n{{skills}}',
  'hr',
  ARRAY['resume', 'cv', 'hiring', 'recruitment'],
  true,
  '[
    {"id": "full_name", "name": "Full Name", "type": "text", "description": "Candidate''s full name", "extraction_hints": ["name", "candidate name"]},
    {"id": "email", "name": "Email", "type": "text", "description": "Email address", "extraction_hints": ["email", "contact"]},
    {"id": "phone", "name": "Phone", "type": "text", "description": "Phone number", "extraction_hints": ["phone", "mobile", "contact"]},
    {"id": "location", "name": "Location", "type": "text", "description": "City, state or address", "extraction_hints": ["location", "address", "city"]},
    {"id": "experience", "name": "Work Experience", "type": "text", "description": "Professional experience summary", "extraction_hints": ["experience", "work history", "employment"]},
    {"id": "education", "name": "Education", "type": "text", "description": "Educational background", "extraction_hints": ["education", "degree", "university", "school"]},
    {"id": "skills", "name": "Skills", "type": "text", "description": "Technical and professional skills", "extraction_hints": ["skills", "technologies", "competencies"]}
  ]'::jsonb,
  '[
    {"variable_id": "full_name", "ai_prompt": "Extract the candidate''s full name from this resume", "confidence_threshold": 0.9},
    {"variable_id": "email", "ai_prompt": "Find the email address", "confidence_threshold": 0.9},
    {"variable_id": "experience", "ai_prompt": "Summarize the work experience and job history", "confidence_threshold": 0.7}
  ]'::jsonb
),
(
  'Contract Key Terms Extractor',
  'Extract important terms and clauses from legal contracts',
  '# Contract Summary\n\n**Contract Type:** {{contract_type}}\n**Parties:** {{parties}}\n**Effective Date:** {{effective_date}}\n**Expiration Date:** {{expiration_date}}\n**Contract Value:** {{contract_value}}\n\n## Key Terms\n{{key_terms}}\n\n## Payment Terms\n{{payment_terms}}',
  'legal',
  ARRAY['contract', 'legal', 'agreement', 'terms'],
  true,
  '[
    {"id": "contract_type", "name": "Contract Type", "type": "text", "description": "Type of contract or agreement", "extraction_hints": ["agreement", "contract type", "service agreement"]},
    {"id": "parties", "name": "Contract Parties", "type": "text", "description": "Names of contracting parties", "extraction_hints": ["parties", "between", "contracting parties"]},
    {"id": "effective_date", "name": "Effective Date", "type": "date", "description": "When contract becomes effective", "extraction_hints": ["effective date", "start date", "commencement"]},
    {"id": "expiration_date", "name": "Expiration Date", "type": "date", "description": "Contract end or expiration date", "extraction_hints": ["expiration", "end date", "termination date"]},
    {"id": "contract_value", "name": "Contract Value", "type": "currency", "description": "Total contract value", "extraction_hints": ["value", "amount", "total cost"]},
    {"id": "key_terms", "name": "Key Terms", "type": "text", "description": "Important contract terms", "extraction_hints": ["terms", "conditions", "clauses"]},
    {"id": "payment_terms", "name": "Payment Terms", "type": "text", "description": "Payment schedule and terms", "extraction_hints": ["payment", "billing", "payment terms"]}
  ]'::jsonb,
  '[
    {"variable_id": "parties", "ai_prompt": "Identify all parties involved in this contract", "confidence_threshold": 0.8},
    {"variable_id": "contract_value", "ai_prompt": "Find the total contract value or amount", "confidence_threshold": 0.8},
    {"variable_id": "key_terms", "ai_prompt": "Extract the most important terms and conditions", "confidence_threshold": 0.7}
  ]'::jsonb
),
(
  'Receipt Scanner',
  'Extract purchase information from receipts',
  '# Receipt Details\n\n**Store:** {{store_name}}\n**Date:** {{purchase_date}}\n**Total:** {{total_amount}}\n**Tax:** {{tax_amount}}\n**Payment Method:** {{payment_method}}\n\n## Items\n{{items}}',
  'finance',
  ARRAY['receipt', 'expense', 'purchase', 'accounting'],
  true,
  '[
    {"id": "store_name", "name": "Store Name", "type": "text", "description": "Name of store or merchant", "extraction_hints": ["store", "merchant", "retailer"]},
    {"id": "purchase_date", "name": "Purchase Date", "type": "date", "description": "Date of purchase", "extraction_hints": ["date", "purchase date", "transaction date"]},
    {"id": "total_amount", "name": "Total Amount", "type": "currency", "description": "Total purchase amount", "extraction_hints": ["total", "amount", "subtotal"]},
    {"id": "tax_amount", "name": "Tax Amount", "type": "currency", "description": "Tax amount", "extraction_hints": ["tax", "sales tax", "VAT"]},
    {"id": "payment_method", "name": "Payment Method", "type": "text", "description": "How payment was made", "extraction_hints": ["payment", "card", "cash", "credit"]},
    {"id": "items", "name": "Items Purchased", "type": "text", "description": "List of items bought", "extraction_hints": ["items", "products", "purchases"]}
  ]'::jsonb,
  '[
    {"variable_id": "total_amount", "ai_prompt": "Find the total amount spent", "confidence_threshold": 0.9},
    {"variable_id": "store_name", "ai_prompt": "Identify the store or merchant name", "confidence_threshold": 0.8},
    {"variable_id": "items", "ai_prompt": "List all items purchased", "confidence_threshold": 0.7}
  ]'::jsonb
),
(
  'Medical Report Summarizer',
  'Extract key information from medical reports and lab results',
  '# Medical Report Summary\n\n**Patient:** {{patient_name}}\n**Date:** {{report_date}}\n**Doctor:** {{doctor_name}}\n**Test Type:** {{test_type}}\n\n## Key Findings\n{{findings}}\n\n## Recommendations\n{{recommendations}}',
  'healthcare',
  ARRAY['medical', 'health', 'lab-results', 'patient'],
  true,
  '[
    {"id": "patient_name", "name": "Patient Name", "type": "text", "description": "Patient''s name", "extraction_hints": ["patient", "name", "patient name"]},
    {"id": "report_date", "name": "Report Date", "type": "date", "description": "Date of report or test", "extraction_hints": ["date", "report date", "test date"]},
    {"id": "doctor_name", "name": "Doctor Name", "type": "text", "description": "Attending physician", "extraction_hints": ["doctor", "physician", "MD", "Dr."]},
    {"id": "test_type", "name": "Test Type", "type": "text", "description": "Type of medical test", "extraction_hints": ["test", "exam", "procedure"]},
    {"id": "findings", "name": "Key Findings", "type": "text", "description": "Important medical findings", "extraction_hints": ["findings", "results", "diagnosis"]},
    {"id": "recommendations", "name": "Recommendations", "type": "text", "description": "Doctor''s recommendations", "extraction_hints": ["recommendations", "treatment", "follow-up"]}
  ]'::jsonb,
  '[
    {"variable_id": "findings", "ai_prompt": "Summarize the key medical findings from this report", "confidence_threshold": 0.8},
    {"variable_id": "recommendations", "ai_prompt": "Extract treatment recommendations", "confidence_threshold": 0.7},
    {"variable_id": "test_type", "ai_prompt": "Identify the type of medical test or examination", "confidence_threshold": 0.8}
  ]'::jsonb
),
(
  'Insurance Claim Form',
  'Process insurance claims and extract relevant details',
  '# Insurance Claim\n\n**Claim Number:** {{claim_number}}\n**Policy Number:** {{policy_number}}\n**Claimant:** {{claimant_name}}\n**Incident Date:** {{incident_date}}\n**Claim Amount:** {{claim_amount}}\n\n## Incident Description\n{{incident_description}}',
  'insurance',
  ARRAY['insurance', 'claim', 'policy', 'coverage'],
  true,
  '[
    {"id": "claim_number", "name": "Claim Number", "type": "text", "description": "Insurance claim number", "extraction_hints": ["claim number", "claim #", "reference"]},
    {"id": "policy_number", "name": "Policy Number", "type": "text", "description": "Insurance policy number", "extraction_hints": ["policy", "policy number", "policy #"]},
    {"id": "claimant_name", "name": "Claimant Name", "type": "text", "description": "Name of person filing claim", "extraction_hints": ["claimant", "insured", "policyholder"]},
    {"id": "incident_date", "name": "Incident Date", "type": "date", "description": "Date of incident", "extraction_hints": ["incident date", "date of loss", "occurrence date"]},
    {"id": "claim_amount", "name": "Claim Amount", "type": "currency", "description": "Amount being claimed", "extraction_hints": ["amount", "claim amount", "damages"]},
    {"id": "incident_description", "name": "Incident Description", "type": "text", "description": "Description of what happened", "extraction_hints": ["description", "incident", "what happened"]}
  ]'::jsonb,
  '[
    {"variable_id": "claim_amount", "ai_prompt": "Find the total claim amount being requested", "confidence_threshold": 0.9},
    {"variable_id": "incident_description", "ai_prompt": "Summarize the incident description", "confidence_threshold": 0.7},
    {"variable_id": "policy_number", "ai_prompt": "Extract the insurance policy number", "confidence_threshold": 0.8}
  ]'::jsonb
),
(
  'Bank Statement Analyzer',
  'Extract transaction data from bank statements',
  '# Bank Statement Summary\n\n**Account:** {{account_number}}\n**Statement Period:** {{statement_period}}\n**Opening Balance:** {{opening_balance}}\n**Closing Balance:** {{closing_balance}}\n**Total Deposits:** {{total_deposits}}\n**Total Withdrawals:** {{total_withdrawals}}',
  'finance',
  ARRAY['banking', 'statement', 'transactions', 'finance'],
  true,
  '[
    {"id": "account_number", "name": "Account Number", "type": "text", "description": "Bank account number", "extraction_hints": ["account", "account number", "account #"]},
    {"id": "statement_period", "name": "Statement Period", "type": "text", "description": "Date range of statement", "extraction_hints": ["period", "statement period", "from", "to"]},
    {"id": "opening_balance", "name": "Opening Balance", "type": "currency", "description": "Starting balance", "extraction_hints": ["opening balance", "starting balance", "previous balance"]},
    {"id": "closing_balance", "name": "Closing Balance", "type": "currency", "description": "Ending balance", "extraction_hints": ["closing balance", "ending balance", "current balance"]},
    {"id": "total_deposits", "name": "Total Deposits", "type": "currency", "description": "Sum of all deposits", "extraction_hints": ["deposits", "credits", "total deposits"]},
    {"id": "total_withdrawals", "name": "Total Withdrawals", "type": "currency", "description": "Sum of all withdrawals", "extraction_hints": ["withdrawals", "debits", "total withdrawals"]}
  ]'::jsonb,
  '[
    {"variable_id": "closing_balance", "ai_prompt": "Find the closing or ending balance", "confidence_threshold": 0.9},
    {"variable_id": "opening_balance", "ai_prompt": "Find the opening or starting balance", "confidence_threshold": 0.9},
    {"variable_id": "account_number", "ai_prompt": "Extract the bank account number", "confidence_threshold": 0.8}
  ]'::jsonb
);

-- Update usage stats for better visibility
UPDATE smart_templates SET usage_count = floor(random() * 50) + 10 WHERE usage_count = 0;
UPDATE smart_templates SET rating = round((random() * 2 + 3)::numeric, 1) WHERE rating = 0.0;