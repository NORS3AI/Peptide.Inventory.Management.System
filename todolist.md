When simulating an order, make sure the names of the users are all different and that it simulates properly. 

/admin/orders needs to track if user used a coupon and what coupon code. Columns in Orders need to be sortable ascend/descend. In the Order Items > Product ID, use the SKU1

When in /admin/orders and clicking on customer, it cannot say Unknown customer, when the name is in the Customer field. The order details needs to cover how they tried to pay, whether credit card, venmo, bitcoin. There needs to be an option to see more details, all about this user: It should share the details of the customer, so customer support can contact them. It needs to show how long they spent on the website, on which pages. It needs to show how long they've been a member and when they joined.

going to /admin/customers and clicking on a customer does not bring up the customer details, it does nothing

Clicking outside of the modal if, for example, going to /admin/customers brings up the Customer Details, clicking outside to modal works the same as clicking the little X in the corner. Add a Simulation: Add Customer button to this page that will add one customer with full details only in simulation mode, if Simulation mode is turned on in /admin/settings. 

Add description/flavor text of what subscriptions are, and how admin can use them.

There needs to be a way in /admin/customers to edit a user to add money to their wallet as store credit, and a way to make them an affiliate/wholesaler. 

The number 5 that is hard coded to /admin/orders needs to realistically match all the processing orders.

New Arrival products on homepage still New Arrival products that don't have the New Arrival products checkmark in /admin/products.

/admin/products still shows the raw code {"research_overview":... for every item under product name in teh product column. 

Columns in /admin/products, /admin/inventory, /admin/orders, /admin/supplies, /admin/customers, /admin/subscriptions, /admin/coupons, /admin/pages, /admin/coas need to all have sortable columns (ascend/descend). Add a button on all pages with columns to be able to sort columns, hide columns, show columns, filter columns.

Make this site mobile and tablet friendly. Currently a hassle. 

New Automation needs to be more friendly. Admin don't know Trigger or Action config for JSON. They need to be plain english. Drop downs for Trigger and Action need to be more robust, for all options that would be necessary for trigger/action. When creating an automation, this error'd out.

Create a Graphs under Reports under MAIN in /admin that shows lots of graphs, and pie, chart, line, and other graphs for all details of what's going on.

Roles in /admin/settings need to be sorted from Super Admin at the top, then Admin. Others can follow as they do. Editing a role needs to show the currently selected permissions, so the Admin can see what the role already does. Make the Permissions a lot like creating roles in Discord. "https://support.discord.com/hc/en-us/articles/214836687-Discord-Roles-and-Permissions". Admins and Super Admins should have an Eye Icon next to the Edit icon, to see what the role would "look" like if they were assigned that role, to make sure that all permissions are working as intended. There should be a way of turning off this "look" when in it, perhaps on the top right corner, have it be blinking red and blue, telling the Admin/Super Admin they are currently in a Preview for Roles. Clicking on that button will turn the Preview off, and return to normal Admin/Super Admin. 

In /admin, at the very bottom left where it shows "Admin User" and the email, this needs to reflect the real Admin or Super Admin's name and email.

The Inventory section needs to be its own built-in module, and it needs to be this: "https://github.com/NORS3AI/Oath-Inventory" exactly. Read the "https://github.com/NORS3AI/Oath-Inventory/blob/main/CLAUDE.md" and the "https://github.com/NORS3AI/Oath-Inventory/blob/main/README.md" and the "https://github.com/NORS3AI/Oath-Inventory/blob/main/features.md". Rename OATH to NORS3 R3SEARCH. 

Admin > Inventory needs to be updated quite a bit; Each column needs to be able to be ascend/descend sorted. Add columns for Sale Price, Velocity (the rate at which the product is being purchased), SKU1 (for Admin Database), SKU2 (for user interface), Size (Will list either MG or ML), Quantity, Labeled/Quantity (where Labeled can be edited/added, out of Quantity), Off Books (where it subtracts Quantity from Labeled), Status (Good Stock, Low Stock (less than 50), Nearly Out (less than 10), Out of Stock), Batch #, Net Weight, Purity, Ordered QTY, Ordered Date, Notes, Actions. Actions will allow for edits to 1. Place Order (Date Ordered, Quantity Ordered, Supplier); 2. Recieve Shipment (Date Arrived, Batch Number, Received Quantity); 3. Send for Testing (Date Sent for Testing, Testing Facility); 4. Record Results (Date Results Received, Purity %, Net Weight in MG) with a disclaimer white text blue background, curved rectangular "After recording results with purity and net weight, this peptide can be marked as ready for sale (pending labeling)." with a Record Results button in green at the bottom to record all this. I use: https://nors3ai.github.io/Oath-Inventory/ (https://github.com/NORS3AI/Oath-Inventory) for all Inventory. This system should be copy/pasted into the site, as it is the best Inventory I've ever created. 

Update Patch Notes.

Push, Commit. 
