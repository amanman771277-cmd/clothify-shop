import React from 'react';
import { useCompare } from '../contexts/CompareContext';
import { Trash2, X, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LazyImage } from '../components/LazyImage';

export const Compare: React.FC = () => {
  const { compareItems, removeFromCompare, clearCompare } = useCompare();

  if (compareItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Compare Products</h1>
        <p className="text-slate-500 mb-8">No products in comparison list.</p>
        <Link to="/" className="bg-slate-900 text-white px-6 py-3 rounded-full font-medium hover:bg-slate-800">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <button 
        onClick={() => window.history.back()}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Compare Products</h1>
        <button 
          onClick={clearCompare}
          className="text-red-600 hover:text-red-700 font-medium flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Clear All
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {compareItems.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative">
            <button 
              onClick={() => removeFromCompare(item.id)}
              className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-900"
            >
              <X className="w-5 h-5" />
            </button>
            <LazyImage src={item.imageUrl} alt={item.name} className="w-full aspect-square rounded-xl mb-4" />
            <h3 className="font-bold text-lg text-slate-900 mb-1">{item.name}</h3>
            <p className="text-slate-600 font-medium mb-4">{item.price} ETB</p>
            <Link to={`/product/${item.id}`} className="block w-full text-center bg-slate-100 text-slate-900 py-2 rounded-xl font-medium hover:bg-slate-200">
              View Details
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};
