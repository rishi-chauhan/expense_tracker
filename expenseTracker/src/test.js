// import React, { useState, useMemo } from 'react';

// // --- Mock Shadcn/UI Components (Placeholder - Replace with actual imports if using shadcn/ui) ---
// // Mock Lucide Icons (Placeholder)
// const Trash2 = ({ className }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;

// // Mock Button Component
// const Button = ({ children, onClick, className = '', variant = 'default', size = 'default', ...props }) => (
//   <button
//     onClick={onClick}
//     className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
//       ${variant === 'destructive' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-blue-500 text-white hover:bg-blue-600'}
//       ${size === 'icon' ? 'h-10 w-10' : 'h-10 px-4 py-2'}
//       ${className}`}
//     {...props}
//   >
//     {children}
//   </button>
// );

// // Mock Table Components
// const Table = ({ children, className = '' }) => <div className={`w-full caption-bottom text-sm ${className}`}><table className="w-full">{children}</table></div>;
// const TableHeader = ({ children, className = '' }) => <thead className={`[&_tr]:border-b ${className}`}>{children}</thead>;
// const TableHead = ({ children, className = '' }) => <th className={`h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 ${className}`}>{children}</th>;
// const TableBody = ({ children, className = '' }) => <tbody className={`[&_tr:last-child]:border-0 ${className}`}>{children}</tbody>;
// const TableRow = ({ children, className = '' }) => <tr className={`border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted ${className}`}>{children}</tr>;
// const TableCell = ({ children, className = '' }) => <td className={`p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className}`}>{children}</td>;

// // Mock Card Components
// const Card = ({ children, className = '' }) => <div className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}>{children}</div>;
// const CardHeader = ({ children, className = '' }) => <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>;
// const CardTitle = ({ children, className = '' }) => <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>{children}</h3>;
// const CardContent = ({ children, className = '' }) => <div className={`p-6 pt-0 ${className}`}>{children}</div>;
// const CardFooter = ({ children, className = '' }) => <div className={`flex items-center p-6 pt-0 ${className}`}>{children}</div>;

// // --- Helper function to format date ---
// const formatDate = (dateString) => {
//     // Input format: DD/MM/YYYY
//     const parts = dateString.split('/');
//     if (parts.length === 3) {
//         // Output format: YYYY-MM-DD
//         return `${parts[2]}-${parts[1]}-${parts[0]}`;
//     }
//     return dateString; // Return original if format is unexpected
// };

// // --- Helper function to categorize based on description ---
// const categorizeExpense = (description) => {
//     const lowerDesc = description.toLowerCase();
//     if (lowerDesc.includes('uber') || lowerDesc.includes('flight') || lowerDesc.includes('railway')) return 'Travel';
//     if (lowerDesc.includes('book my show') || lowerDesc.includes('netflix')) return 'Entertainment';
//     if (lowerDesc.includes('zomato') || lowerDesc.includes('swiggy') || lowerDesc.includes('ratnadeep')) return 'Food';
//     if (lowerDesc.includes('petroleum') || lowerDesc.includes('petro')) return 'Fuel';
//     if (lowerDesc.includes('bbps') || lowerDesc.includes('instapay')) return 'Bills/Utilities'; // Assuming BBPS are bill payments
//     if (lowerDesc.includes('payzapp wallet')) return 'Wallet Load';
//     if (lowerDesc.includes('urbanclap')) return 'Services';
//     if (lowerDesc.includes('shopping') || lowerDesc.includes('retail')) return 'Shopping';
//     return 'Other'; // Default category
// }

// // --- Data extracted manually from APRIL 2022.PDF ---
// const extractedExpensesData = [
//   { id: 1, date: '27/03/2022', description: 'MAA SHAKTI FILING CENT RAEBARELI', amount: 1011.80 },
//   { id: 2, date: '28/03/2022', description: 'UBER INDIA SYSTEMS PRIVNOIDA', amount: 72.00 },
//   { id: 3, date: '02/04/2022', description: 'SMARTBUY FLIGHT CT BANGALORE', amount: 2097.00 },
//   { id: 4, date: '02/04/2022', description: 'BOOK MY SHOW MUMBAI', amount: 2560.96 },
//   { id: 5, date: '02/04/2022', description: 'IGST-VPS2309312435155-RATE 18.0-09', amount: 17.82 }, // GST Charge
//   { id: 6, date: '02/04/2022', description: 'REDEMPTION PROC FEE', amount: 99.00 }, // Fee
//   { id: 7, date: '03/04/2022', description: 'Instapay BBPS PAYNOW', amount: 1316.00 },
//   { id: 8, date: '03/04/2022', description: 'BOOK MY SHOW MUMBAI', amount: 640.24 },
//   { id: 9, date: '05/04/2022', description: 'TALENTEGDE AESPL MUMBAI', amount: 47200.00 },
//   { id: 10, date: '06/04/2022', description: 'Instapay BBPS PAYNOW', amount: 824.82 },
//   { id: 11, date: '12/04/2022', description: 'INDIAN RAILWAY CATERINGNEW DELHI', amount: 492.58 },
//   { id: 12, date: '14/04/2022', description: 'NETFLIX MUMBAI', amount: 649.00 },
//   { id: 13, date: '16/04/2022', description: 'PARMESWAR PETROLEUM BASTI', amount: 2020.00 },
//   { id: 14, date: '17/04/2022', description: 'Instapay BBPS PAYNOW', amount: 2660.00 },
//   { id: 15, date: '18/04/2022', description: 'SRI VENKATESHWARA AGEN HYDERABAD', amount: 260.00 },
//   { id: 16, date: '18/04/2022', description: 'SWIGGY BANGALORE', amount: 257.00 },
//   { id: 17, date: '19/04/2022', description: 'PayZapp Wallet- PayZapp WBangalore', amount: 130.00 },
//   { id: 18, date: '19/04/2022', description: 'RATNADEEP RETAIL PRIVA HYDERABAD', amount: 427.00 },
//   { id: 19, date: '20/04/2022', description: 'ZOMATO GURGAON', amount: 276.70 },
//   { id: 20, date: '21/04/2022', description: 'ZOMATO PVT LTD (HYPERPURGURGAON', amount: 341.35 },
//   { id: 21, date: '21/04/2022', description: 'ZOMATO PVT LTD (HYPERPURGURGAON', amount: 191.77 },
//   { id: 22, date: '21/04/2022', description: 'SWIGGY BANGALORE', amount: 317.00 },
//   { id: 23, date: '21/04/2022', description: 'URBANCLAP TECHNOLOGIES HTTPS://WW', amount: 538.20 },
//   { id: 24, date: '22/04/2022', description: 'PayZapp Wallet- PayZapp WBangalore', amount: 500.00 },
// ].map(expense => ({
//     ...expense,
//     date: formatDate(expense.date), // Format date to YYYY-MM-DD
//     category: categorizeExpense(expense.description) // Assign category
// }));


// // --- Expense Tracker Application ---
// function App() {
//   // State for the list of expenses, initialized with data from PDF
//   const [expenses, setExpenses] = useState(extractedExpensesData);

//   // Function to handle deleting an expense
//   const handleDeleteExpense = (idToDelete) => {
//     setExpenses(expenses.filter(expense => expense.id !== idToDelete));
//   };

//   // Calculate total expenses using useMemo for optimization
//   const totalExpenses = useMemo(() => {
//     return expenses.reduce((total, expense) => total + expense.amount, 0);
//   }, [expenses]); // Recalculate only when expenses change

//   return (
//     <div className="container mx-auto p-4 font-sans bg-gray-50 min-h-screen">
//       <h1 className="text-3xl font-bold text-center mb-8 text-blue-600">Expense Tracker</h1>

//       {/* Information Box */}
//        <Card className="mb-8 shadow-md bg-blue-50 border-blue-200">
//          <CardContent className="p-4">
//             <p className="text-sm text-blue-700">
//                 Displaying expenses extracted from the sample statement (APRIL 2022.PDF).
//                 Actual PDF upload and parsing functionality requires additional libraries and setup.
//             </p>
//          </CardContent>
//        </Card>

//       {/* --- Expenses List --- */}
//       <Card className="shadow-lg">
//         <CardHeader className="flex flex-row items-center justify-between">
//           <CardTitle className="text-xl text-gray-700">Expenses from Statement</CardTitle>
//            <div className="text-right">
//                 <p className="text-sm text-gray-500">Total Expenses</p>
//                 <p className="text-2xl font-semibold text-blue-600">
//                     ${totalExpenses.toFixed(2)}
//                 </p>
//            </div>
//         </CardHeader>
//         <CardContent>
//           <Table>
//             <TableHeader>
//               <TableRow className="bg-gray-100">
//                 <TableHead className="w-[120px]">Date</TableHead>
//                 <TableHead>Description</TableHead>
//                 <TableHead>Category</TableHead>
//                 <TableHead className="text-right">Amount</TableHead>
//                 <TableHead className="text-center w-[80px]">Actions</TableHead>
//               </TableRow>
//             </TableHeader>
//             <TableBody>
//               {expenses.length > 0 ? (
//                 expenses
//                   .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date descending
//                   .map((expense) => (
//                     <TableRow key={expense.id} className="hover:bg-gray-50">
//                       <TableCell>{expense.date}</TableCell>
//                       <TableCell className="font-medium">{expense.description}</TableCell>
//                       <TableCell>
//                         <span className={`px-2 py-1 text-xs font-semibold rounded-full ${expense.category === 'Food' ? 'bg-green-100 text-green-800' : expense.category === 'Travel' ? 'bg-purple-100 text-purple-800' : expense.category === 'Entertainment' ? 'bg-yellow-100 text-yellow-800': expense.category === 'Bills/Utilities' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
//                             {expense.category}
//                         </span>
//                       </TableCell>
//                       <TableCell className="text-right">${expense.amount.toFixed(2)}</TableCell>
//                       <TableCell className="text-center">
//                         <Button
//                           variant="destructive"
//                           size="icon"
//                           onClick={() => handleDeleteExpense(expense.id)}
//                           className="bg-red-100 hover:bg-red-200 text-red-600"
//                           aria-label="Delete expense"
//                         >
//                           <Trash2 className="h-4 w-4" />
//                         </Button>
//                       </TableCell>
//                     </TableRow>
//                   ))
//               ) : (
//                 <TableRow>
//                   <TableCell colSpan="5" className="text-center text-gray-500 py-10">
//                     No expenses found in the statement data.
//                   </TableCell>
//                 </TableRow>
//               )}
//             </TableBody>
//           </Table>
//         </CardContent>
//          {expenses.length > 0 && (
//             <CardFooter className="justify-end pt-4 border-t">
//                  <p className="text-lg font-semibold text-gray-700">
//                     Total: ${totalExpenses.toFixed(2)}
//                  </p>
//             </CardFooter>
//          )}
//       </Card>
//     </div>
//   );
// }

// export default App;