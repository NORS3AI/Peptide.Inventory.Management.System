import { useState } from 'react';
import { Calendar, Package, FlaskConical, CheckCircle, X, Plus } from 'lucide-react';
import { db } from '../lib/db';

export default function OrderManagement({ peptide, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('place-order');
  const [formData, setFormData] = useState({
    // Order placement
    dateOrdered: new Date().toISOString().split('T')[0],
    quantityOrdered: '',
    supplier: peptide?.supplier || '',

    // Receiving
    dateArrived: new Date().toISOString().split('T')[0],
    batchNumber: '',
    receivedQuantity: '',

    // Testing
    dateSentForTesting: new Date().toISOString().split('T')[0],
    testingFacility: '',

    // Results
    dateResultsReceived: new Date().toISOString().split('T')[0],
    purity: '',
    netWeight: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePlaceOrder = async () => {
    setSaving(true);
    setError(null);
    try {
      const orderId = `${peptide.peptideId}-${Date.now()}`;
      await db.orders.set(orderId, {
        peptideId: peptide.peptideId,
        peptideName: peptide.peptideName,
        dateOrdered: formData.dateOrdered,
        quantityOrdered: Number(formData.quantityOrdered),
        supplier: formData.supplier,
        status: 'ordered',
        createdAt: new Date().toISOString()
      });

      // Update peptide with ordered info
      await db.peptides.update(peptide.peptideId, {
        orderedDate: formData.dateOrdered,
        orderedQty: Number(formData.quantityOrdered),
        hasActiveOrder: true
      });

      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      setError('Failed to place order: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReceiveShipment = async () => {
    setSaving(true);
    setError(null);
    try {
      // Find active order for this peptide
      const orders = await db.orders.getByPeptideId(peptide.peptideId);
      const activeOrder = orders.find(o => o.status === 'ordered');

      if (activeOrder) {
        await db.orders.update(activeOrder.id, {
          dateArrived: formData.dateArrived,
          receivedQuantity: Number(formData.receivedQuantity),
          batchNumber: formData.batchNumber,
          status: 'received'
        });
      }

      // Update peptide
      await db.peptides.update(peptide.peptideId, {
        quantity: peptide.quantity + Number(formData.receivedQuantity),
        batchNumber: formData.batchNumber,
        hasActiveOrder: false
      });

      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      setError('Failed to receive shipment: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendForTesting = async () => {
    setSaving(true);
    setError(null);
    try {
      // Find received order
      const orders = await db.orders.getByPeptideId(peptide.peptideId);
      const receivedOrder = orders.find(o => o.status === 'received');

      if (receivedOrder) {
        await db.orders.update(receivedOrder.id, {
          dateSentForTesting: formData.dateSentForTesting,
          testingFacility: formData.testingFacility,
          status: 'testing'
        });
      }

      await db.peptides.update(peptide.peptideId, {
        dateSentForTesting: formData.dateSentForTesting
      });

      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      setError('Failed to send for testing: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRecordResults = async () => {
    setSaving(true);
    setError(null);
    try {
      // Find testing order
      const orders = await db.orders.getByPeptideId(peptide.peptideId);
      const testingOrder = orders.find(o => o.status === 'testing');

      if (testingOrder) {
        await db.orders.update(testingOrder.id, {
          dateResultsReceived: formData.dateResultsReceived,
          purity: formData.purity,
          netWeight: formData.netWeight,
          status: 'completed'
        });
      }

      await db.peptides.update(peptide.peptideId, {
        purity: formData.purity,
        netWeight: formData.netWeight,
        dateResultsReceived: formData.dateResultsReceived
      });

      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      setError('Failed to record results: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'place-order', label: '1. Place Order', icon: Plus },
    { id: 'receive', label: '2. Receive Shipment', icon: Package },
    { id: 'testing', label: '3. Send for Testing', icon: FlaskConical },
    { id: 'results', label: '4. Record Results', icon: CheckCircle }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Order Lifecycle Tracking</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {peptide?.peptideId} - {peptide?.peptideName}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Place Order */}
          {activeTab === 'place-order' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Record when you place an order for this peptide</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date Ordered *
                </label>
                <input
                  type="date"
                  value={formData.dateOrdered}
                  onChange={(e) => handleChange('dateOrdered', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quantity Ordered (mg) *
                </label>
                <input
                  type="number"
                  value={formData.quantityOrdered}
                  onChange={(e) => handleChange('quantityOrdered', e.target.value)}
                  placeholder="Enter quantity"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Supplier
                </label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => handleChange('supplier', e.target.value)}
                  placeholder="Lab or supplier name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={!formData.quantityOrdered || saving}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? 'Placing Order...' : 'Place Order'}
              </button>
            </div>
          )}

          {/* Receive Shipment */}
          {activeTab === 'receive' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Record when the shipment arrives from the lab</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date Arrived *
                </label>
                <input
                  type="date"
                  value={formData.dateArrived}
                  onChange={(e) => handleChange('dateArrived', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Batch Number *
                </label>
                <input
                  type="text"
                  value={formData.batchNumber}
                  onChange={(e) => handleChange('batchNumber', e.target.value)}
                  placeholder="Enter batch number"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Received Quantity (mg) *
                </label>
                <input
                  type="number"
                  value={formData.receivedQuantity}
                  onChange={(e) => handleChange('receivedQuantity', e.target.value)}
                  placeholder="Actual quantity received"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleReceiveShipment}
                disabled={!formData.batchNumber || !formData.receivedQuantity || saving}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? 'Recording Receipt...' : 'Receive Shipment'}
              </button>
            </div>
          )}

          {/* Send for Testing */}
          {activeTab === 'testing' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Record when you send the batch for testing</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date Sent for Testing *
                </label>
                <input
                  type="date"
                  value={formData.dateSentForTesting}
                  onChange={(e) => handleChange('dateSentForTesting', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Testing Facility
                </label>
                <input
                  type="text"
                  value={formData.testingFacility}
                  onChange={(e) => handleChange('testingFacility', e.target.value)}
                  placeholder="Lab name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleSendForTesting}
                disabled={saving}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? 'Recording...' : 'Send for Testing'}
              </button>
            </div>
          )}

          {/* Record Results */}
          {activeTab === 'results' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Record testing results (purity and net weight)</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date Results Received *
                </label>
                <input
                  type="date"
                  value={formData.dateResultsReceived}
                  onChange={(e) => handleChange('dateResultsReceived', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Purity (%) *
                </label>
                <input
                  type="text"
                  value={formData.purity}
                  onChange={(e) => handleChange('purity', e.target.value)}
                  placeholder="e.g., 98.5%"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Net Weight *
                </label>
                <input
                  type="text"
                  value={formData.netWeight}
                  onChange={(e) => handleChange('netWeight', e.target.value)}
                  placeholder="e.g., 245mg"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  ✓ After recording results with purity and net weight, this peptide can be marked as ready for sale (pending labeling).
                </p>
              </div>

              <button
                onClick={handleRecordResults}
                disabled={!formData.purity || !formData.netWeight || saving}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? 'Recording Results...' : 'Record Results'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
