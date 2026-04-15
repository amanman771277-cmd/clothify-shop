import React, { useState } from 'react';
import { Loader2, X, Plus, Edit2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { LazyImage } from './LazyImage';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  imageUrl: string;
  imageUrls?: string[];
  sizes?: string[];
  colors?: string[];
  sellerId?: string;
  sellerName?: string;
}

interface AddProductFormProps {
  editingProduct?: Product | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const CATEGORIES = ['Men', 'Women', 'Kids', 'Shoes'];

export const AddProductForm: React.FC<AddProductFormProps> = ({ editingProduct, onSuccess, onCancel }) => {
  const { user, userData } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>(editingProduct ? [editingProduct.imageUrl, ...(editingProduct.imageUrls || [])] : []);
  const [formData, setFormData] = useState({
    name: editingProduct?.name || '',
    description: editingProduct?.description || '',
    price: editingProduct?.price.toString() || '',
    originalPrice: editingProduct?.originalPrice?.toString() || '',
    category: editingProduct?.category || CATEGORIES[0],
    imageUrl: editingProduct?.imageUrl || '',
    imageUrls: editingProduct?.imageUrls?.join('\n') || '',
    sizes: editingProduct?.sizes?.join(', ') || '',
    colors: editingProduct?.colors?.join(', ') || ''
  });

  React.useEffect(() => {
    if (editingProduct) {
      setFormData({
        name: editingProduct.name || '',
        description: editingProduct.description || '',
        price: editingProduct.price?.toString() || '',
        originalPrice: editingProduct.originalPrice?.toString() || '',
        category: editingProduct.category || CATEGORIES[0],
        imageUrl: editingProduct.imageUrl || '',
        imageUrls: editingProduct.imageUrls?.join('\n') || '',
        sizes: editingProduct.sizes?.join(', ') || '',
        colors: editingProduct.colors?.join(', ') || ''
      });
      setImagePreviews([editingProduct.imageUrl, ...(editingProduct.imageUrls || [])].filter(Boolean));
      setImageFiles([]);
    } else {
      setFormData({
        name: '',
        description: '',
        price: '',
        originalPrice: '',
        category: CATEGORIES[0],
        imageUrl: '',
        imageUrls: '',
        sizes: '',
        colors: ''
      });
      setImagePreviews([]);
      setImageFiles([]);
    }
  }, [editingProduct]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingProduct && imageFiles.length < 1) {
      alert("Please upload at least 1 image.");
      return;
    }
    if (imageFiles.length > 5) {
      alert("Please upload a maximum of 5 images.");
      return;
    }
    
    setSubmitting(true);
    try {
      let finalImageUrl = formData.imageUrl;
      let parsedImageUrls = formData.imageUrls ? formData.imageUrls.split(/[\n,]+/).map(url => url.trim()).filter(url => url.length > 0) : [];

      if (imageFiles.length > 0) {
        const cloudName = 'du5fpqadb';
        const uploadPreset = 'pmmwdhtl';
        
        const uploadPromises = imageFiles.map(async (file) => {
          const formDataCloudinary = new FormData();
          formDataCloudinary.append('file', file);
          formDataCloudinary.append('upload_preset', uploadPreset);

          const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: formDataCloudinary,
          });

          if (!res.ok) {
            throw new Error('Failed to upload image to Cloudinary');
          }

          const data = await res.json();
          return data.secure_url;
        });

        const uploadedUrls = await Promise.all(uploadPromises);
        finalImageUrl = uploadedUrls[0];
        parsedImageUrls = uploadedUrls.slice(1);
      } else if (!editingProduct && !finalImageUrl) {
        alert("Please select primary images.");
        setSubmitting(false);
        return;
      }

      const parsedSizes = formData.sizes.split(',').map(s => s.trim()).filter(s => s.length > 0);
      const parsedColors = formData.colors.split(',').map(c => c.trim()).filter(c => c.length > 0);

      const productData: any = {
        name: formData.name,
        description: formData.description,
        price: Number(formData.price),
        category: formData.category,
        imageUrl: finalImageUrl,
        imageUrls: parsedImageUrls,
        sizes: parsedSizes,
        colors: parsedColors
      };

      if (formData.originalPrice) {
        productData.originalPrice = Number(formData.originalPrice);
      }

      if (editingProduct) {
        const updateData = { ...productData };
        if (!editingProduct.sellerId) {
          updateData.sellerId = user?.uid || 'admin';
        }
        if (!(editingProduct as any).createdAt) {
          updateData.createdAt = serverTimestamp();
        }
        await updateDoc(doc(db, 'products', editingProduct.id), updateData);
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          isAvailable: true,
          status: 'active',
          createdAt: serverTimestamp(),
          sellerId: user?.uid || 'admin',
          sellerName: userData?.displayName || user?.displayName || 'Unknown Seller'
        });
      }
      
      onSuccess();
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Failed to save product.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          {editingProduct ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />} 
          {editingProduct ? 'Edit Product' : 'Add New Product'}
        </h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
          <input 
            required
            type="text" 
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
            placeholder="e.g. Classic White Tee"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Price (ETB)</label>
            <input 
              required
              type="number" 
              min="0"
              step="0.01"
              value={formData.price}
              onChange={e => setFormData({...formData, price: e.target.value})}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
              placeholder="e.g. 1500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Compare at Price</label>
            <input 
              type="number" 
              min="0"
              step="0.01"
              value={formData.originalPrice}
              onChange={e => setFormData({...formData, originalPrice: e.target.value})}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
              placeholder="e.g. 2000"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
          <select
            required
            value={formData.category}
            onChange={e => setFormData({...formData, category: e.target.value})}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all bg-white"
          >
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sizes (comma-separated)</label>
            <input 
              type="text" 
              value={formData.sizes}
              onChange={e => setFormData({...formData, sizes: e.target.value})}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
              placeholder="S, M, L, XL"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Colors (comma-separated)</label>
            <input 
              type="text" 
              value={formData.colors}
              onChange={e => setFormData({...formData, colors: e.target.value})}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
              placeholder="Black, White, Navy"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Product Images (Min 1, Max 5)</label>
          <input 
            type="file" 
            accept="image/*"
            multiple
            onChange={e => {
              if (e.target.files) {
                const files = Array.from(e.target.files);
                if (files.length > 5) {
                  alert("You can only upload a maximum of 5 images.");
                  return;
                }
                setImageFiles(files);
                setImagePreviews(files.map((file: File) => URL.createObjectURL(file)));
              }
            }}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
            required={!editingProduct && imagePreviews.length === 0}
          />
          {imagePreviews.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {imagePreviews.map((preview, idx) => (
                <div key={idx} className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-square">
                  <LazyImage 
                    src={preview} 
                    alt={`Preview ${idx + 1}`} 
                    className="w-full h-full"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea 
            required
            rows={4}
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all resize-none"
            placeholder="Product description..."
          />
        </div>
        <button 
          type="submit" 
          disabled={submitting}
          className="w-full bg-slate-900 text-white px-4 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingProduct ? 'Update Product' : 'Save Product')}
        </button>
      </form>
    </div>
  );
};
