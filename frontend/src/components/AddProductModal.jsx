import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { db } from '../lib/db';
import { useToast } from './Toast';

export default function AddProductModal({ isOpen, onClose, onSave }) {
  const { success, error: showError } = useToast();
  const [formData, setFormData] = useState({
    peptideId: '',
    peptideName: '',
    nickname: '',
    quantity: '',
    labeledCount: '',
    batchNumber: '',
    netWeight: '',
    purity: '',
    velocity: '',
    orderedQty: '',
    orderedDate: '',
    notes: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.peptideId || !formData.peptideName) {
      showError('Product ID and SKU are required');
      return;
    }

    try {
      // Create new product object
      const newProduct = {
        peptideId: formData.peptideId.trim(),
        peptideName: formData.peptideName.trim(),
        nickname: formData.nickname.trim() || '',
        quantity: Number(formData.quantity) || 0,
        labeledCount: Number(formData.labeledCount) || 0,
        batchNumber: formData.batchNumber.trim(),
        netWeight: formData.netWeight.trim(),
        purity: formData.purity.trim(),
        velocity: formData.velocity.trim(),
        orderedQty: Number(formData.orderedQty) || 0,
        orderedDate: formData.orderedDate,
        notes: formData.notes.trim(),
        unit: 'mg',
        importedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      // Check if product already exists
      const existing = await db.peptides.get(newProduct.peptideId);
      if (existing) {
        showError(`Product ${newProduct.peptideId} already exists`);
        return;
      }

      // Save to database
      await db.peptides.set(newProduct.peptideId, newProduct);

      success('Product added successfully');

      // Reset form
      setFormData({
        peptideId: '',
        peptideName: '',
        nickname: '',
        quantity: '',
        labeledCount: '',
        batchNumber: '',
        netWeight: '',
        purity: '',
        velocity: '',
        orderedQty: '',
        orderedDate: '',
        notes: ''
      });

      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to add product:', err);
      showError('Failed to add product');
    }
  };

  const handleCancel = () => {
    // Reset form
    setFormData({
      peptideId: '',
      peptideName: '',
      nickname: '',
      quantity: '',
      labeledCount: '',
      batchNumber: '',
      netWeight: '',
      purity: '',
      velocity: '',
      orderedQty: '',
      orderedDate: '',
      notes: ''
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add New Product</h2>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Required Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Product ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.peptideId}
                onChange={(e) => handleChange('peptideId', e.target.value)}
                placeholder="e.g., OATH-BPC-157-5MG"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                SKU <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.peptideName}
                onChange={(e) => handleChange('peptideName', e.target.value)}
                placeholder="e.g., BPC-157 5mg"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>
          </div>

          {/* Nickname */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nickname
            </label>
            <input
              type="text"
              value={formData.nickname}
              onChange={(e) => handleChange('nickname', e.target.value)}
              placeholder="Optional display name (uses SKU if empty)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Quantity Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Quantity
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => handleChange('quantity', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Labeled Count
              </label>
              <input
                type="number"
                value={formData.labeledCount}
                onChange={(e) => handleChange('labeledCount', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Product Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Batch Number
              </label>
              <input
                type="text"
                value={formData.batchNumber}
                onChange={(e) => handleChange('batchNumber', e.target.value)}
                placeholder="e.g., B2024001"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Net Weight
              </label>
              <input
                type="text"
                value={formData.netWeight}
                onChange={(e) => handleChange('netWeight', e.target.value)}
                placeholder="e.g., 5mg"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Purity
              </label>
              <input
                type="text"
                value={formData.purity}
                onChange={(e) => handleChange('purity', e.target.value)}
                placeholder="e.g., 99%"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Order Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Velocity
              </label>
              <input
                type="text"
                value={formData.velocity}
                onChange={(e) => handleChange('velocity', e.target.value)}
                placeholder="e.g., Medium"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ordered Qty
              </label>
              <input
                type="number"
                value={formData.orderedQty}
                onChange={(e) => handleChange('orderedQty', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ordered Date
              </label>
              <input
                type="date"
                value={formData.orderedDate}
                onChange={(e) => handleChange('orderedDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes..."
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors"
            >
              Add Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
