import json

with open('D:\\Software dev\\Tasks\\Moin vai pdfkit\\pdfkit-invoice\\pdfkit-invoice\\pdfkit-invoice\\data\\orders.json', 'r') as f:
    order = json.load(f)

products = []
subtotal = 0
for i in range(100):
    price = 10 + i
    quantity = i % 5 + 1
    product = {
        "name": f"Product {i+1}",
        "price": price,
        "quantity": quantity
    }
    products.append(product)
    subtotal += price * quantity

order['Products'] = products
order['Price_Subtotal'] = subtotal
tax = subtotal * (order['Price_Tax_Percentise'] / 100)
order['Total'] = subtotal + tax + order['Shipping_Cost'] - order['Discount_Amount']


with open('D:\\Software dev\\Tasks\\Moin vai pdfkit\\pdfkit-invoice\\pdfkit-invoice\\pdfkit-invoice\\data\\orders.json', 'w') as f:
    json.dump(order, f, indent=2)

print("Updated data/orders.json with 100 products.")