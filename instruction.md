in POS slip




font: roboto mono, from google, 
normal text font-size: 8

in order detail section , make two columns
left column:
header: Order details
"orderCode". also modify server.js to download as per orderCode
Order Date: format "yyyy-MM-dd hh:mm"
Order Status
Payment Method

right column:
Bill to: 
only name 
Username as Customer ID
contact no. from billingAddressSnapshot.contactNo



Make 3 cols on Item  List:
1st col -Product Name: format items[index].Product.name(items[index].Product.strength) items[index].Product.productType.name

2nd col =Qty×UnitPrice :
    format : items[index].unitPriceRate x unitQuantity

3rd col Amount
    result of (items[index].unitPriceRate x unitQuantity)


Discount amount add a prefix (-)
Add right half hr line before sub-total
Aslo full hr before "thank you" section