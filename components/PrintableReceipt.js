import { format, add } from 'date-fns';

// Utility to format date to IST
const formatToIST = (date) => {
  const utcDate = new Date(date);
  const istDate = add(utcDate, { hours: 5, minutes: 30 });
  return format(istDate, 'dd/MM/yyyy HH:mm:ss');
};

const PrintableReceipt = ({ order }) => {
  const total = order.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

  return (
    <div className="printable-receipt" style={{
      width: '300px',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      lineHeight: '1.4',
      padding: '10px',
      background: '#fff',
      color: '#000',
    }}>
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .printable-receipt, .printable-receipt * {
              visibility: visible;
            }
            .printable-receipt {
              position: absolute;
              left: 0;
              top: 0;
              width: 300px;
              margin: 0;
              padding: 10px;
            }
            @page {
              size: 80mm auto;
              margin: 0;
            }
          }
        `}
      </style>
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0' }}>Gsaheb Cafe</h1>
        <p style={{ margin: '5px 0' }}>Order #{order.order_number || order.id}</p>
        <p style={{ margin: '5px 0' }}>Table {order.tables?.number || order.table_id}</p>
        <p style={{ margin: '5px 0' }}>Date: {formatToIST(new Date(order.created_at))}</p>
      </div>
      <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', paddingBottom: '5px' }}>Item</th>
            <th style={{ textAlign: 'right', paddingBottom: '5px' }}>Qty</th>
            <th style={{ textAlign: 'right', paddingBottom: '5px' }}>Price</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={index}>
              <td style={{ padding: '5px 0', maxWidth: '180px', wordBreak: 'break-word' }}>
                {item.name}
              </td>
              <td style={{ textAlign: 'right', padding: '5px 0' }}>{item.quantity || 1}</td>
              <td style={{ textAlign: 'right', padding: '5px 0' }}>
                ₹{(item.price * (item.quantity || 1)).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
        <span>Total</span>
        <span>₹{total.toFixed(2)}</span>
      </div>
      <div style={{ textAlign: 'center', marginTop: '10px' }}>
        <p>Thank you for dining with us!</p>
      </div>
    </div>
  );
};

export default PrintableReceipt;