import { useState } from 'react';
import { X, TrendingDown } from 'lucide-react';
import { db } from '../lib/db';
import { useToast } from './Toast';

export default function RecordSaleModal({ peptide, onClose, onComplete }) {
  const { success, error } = useToast();
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [transactionType, setTransactionType] = useState('sale');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxQuantity = Number(peptide?.quantity) || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      error('Please enter a valid quantity');
      return;
    }

    if (qty > maxQuantity) {
      error(`Quantity cannot exceed available stock (${maxQuantity})`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Record the transaction
      await db.transactions.record(peptide.peptideId, qty, transactionType, notes);

      // Update the peptide quantity
      const newQuantity = Math.max(0, maxQuantity - qty);
      await db.peptides.update(peptide.peptideId, {
        quantity: newQuantity
      });

      success(`Recorded ${qty} ${transactionType} for ${peptide.peptideId}`);
      onComplete();
      onClose();
    } catch (err) {
      error(`Failed to record transaction: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!peptide) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Record Transaction
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Product
            </label>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {peptide.peptideId}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Available: {maxQuantity} units
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Transaction Type
            </label>
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="sale">Sale</option>
              <option value="adjustment">Inventory Adjustment</option>
              <option value="return">Return</option>
              <option value="damage">Damage/Loss</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Quantity
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              max={maxQuantity}
              placeholder="Enter quantity"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this transaction..."
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Recording...' : 'Record Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
