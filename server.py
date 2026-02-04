from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import os

app = Flask(__name__, static_folder='.')
CORS(app)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

@app.route('/api/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        api_key = data.get('apiKey')
        base64_data = data.get('base64Data')
        chart_of_accounts = data.get('chartOfAccounts')
        
        if not api_key or not base64_data:
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Call Anthropic API
        response = requests.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'Content-Type': 'application/json',
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01'
            },
            json={
                'model': 'claude-sonnet-4-20250514',
                'max_tokens': 4000,
                'messages': [{
                    'role': 'user',
                    'content': [
                        {
                            'type': 'document',
                            'source': {
                                'type': 'base64',
                                'media_type': 'application/pdf',
                                'data': base64_data
                            }
                        },
                        {
                            'type': 'text',
                            'text': f"""You are a QuickBooks categorization assistant. Analyze this bank statement PDF and extract all transactions.

For each transaction, suggest the most appropriate category from this chart of accounts:

{chart_of_accounts}

Respond ONLY with a JSON array in this exact format (no markdown, no explanation):
[
  {{
    "date": "YYYY-MM-DD",
    "description": "transaction description",
    "amount": -123.45,
    "suggestedCategory": "Account Name",
    "confidence": "high/medium/low",
    "reasoning": "brief explanation"
  }}
]

Guidelines:
- For expenses (negative amounts), use Expense accounts
- For income (positive amounts), use Income accounts
- Match descriptions to the most specific category available
- Bank fees → "Bank Fees"
- Gas/fuel → "Vehicles - Fuel & Gas" or "Airplanes - Fuel & Gas"
- Software/subscriptions → "Software & Subscription Expenses"
- Meals/restaurants → "Meals"
- Office supplies → "Supplies"
- Travel expenses → "Travel"
- Professional services → "Contract Labor & Outside Services"
- Aircraft parts/supplies → "Airplanes - Supplies & Materials"
- Aviation fuel → "Airplanes - Fuel & Gas"
- Vehicle fuel → "Vehicles - Fuel & Gas"
- Zelle/Venmo payments to partners for distributions → "Distribution - [Partner Name]"
- Zelle payments for materials/supplies → categorize based on description
- If uncertain, use "Uncategorized Expense" or "Uncategorized Income" """
                        }
                    ]
                }]
            }
        )
        
        if not response.ok:
            return jsonify({'error': f'API Error: {response.status_code}', 'details': response.text}), response.status_code
        
        result = response.json()
        text_content = ''.join([item['text'] for item in result['content'] if item['type'] == 'text'])
        
        # Clean up response
        cleaned_text = text_content.strip()
        cleaned_text = cleaned_text.replace('```json', '').replace('```', '').strip()
        
        return jsonify({'result': cleaned_text})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
