import React, { useEffect, useState, useCallback } from 'react';
import {
  getCategories,
  createCategory,
  deleteCategory,
  createCategoryRule,
  deleteCategoryRule,
  applyCategoryRules,
  getBudgets,
  upsertBudget,
  deleteBudget,
  getRecurring,
} from '../utils/api.js';
import { formatINR } from '../utils/dataProcessing.js';
import './CategoriesPage.css';

function CategoriesPage({ onChanged }) {
  const [categories, setCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#60a5fa');
  const [ruleCategoryId, setRuleCategoryId] = useState('');
  const [rulePattern, setRulePattern] = useState('');
  const [budgetCategoryId, setBudgetCategoryId] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catData, budgetData, recurringData] = await Promise.all([
        getCategories(),
        getBudgets(),
        getRecurring(),
      ]);
      setCategories(catData.categories || []);
      setRules(catData.rules || []);
      setBudgets(budgetData.budgets || []);
      setRecurring(recurringData.recurring || []);
      if (!ruleCategoryId && catData.categories?.length) {
        setRuleCategoryId(String(catData.categories[0].id));
      }
      if (!budgetCategoryId && catData.categories?.length) {
        setBudgetCategoryId(String(catData.categories[0].id));
      }
    } catch (err) {
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [ruleCategoryId, budgetCategoryId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createCategory({ name: newName.trim(), color: newColor });
      setNewName('');
      setMessage('Category created');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (!window.confirm(`Delete category "${name}"?`)) return;
    try {
      await deleteCategory(id);
      await load();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!ruleCategoryId || !rulePattern.trim()) return;
    try {
      await createCategoryRule({
        categoryId: Number(ruleCategoryId),
        pattern: rulePattern.trim(),
        priority: 10,
      });
      setRulePattern('');
      setMessage('Rule added');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteRule = async (id) => {
    try {
      await deleteCategoryRule(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleApplyRules = async () => {
    try {
      const result = await applyCategoryRules();
      setMessage(`Applied rules to ${result.updated} transaction(s)`);
      if (onChanged) await onChanged();
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    const amount = Number(budgetAmount);
    if (!budgetCategoryId || !Number.isFinite(amount) || amount <= 0) return;
    try {
      await upsertBudget({ categoryId: Number(budgetCategoryId), amount });
      setBudgetAmount('');
      setMessage('Budget saved');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteBudget = async (categoryId) => {
    try {
      await deleteBudget(categoryId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="categories-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading categories...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="categories-page">
      <div className="categories-header">
        <h2>Categories &amp; Budgets</h2>
        <p className="categories-subtitle">Tag merchants, set rules, and track monthly budgets</p>
      </div>

      {error && <div className="categories-alert error" role="alert">{error}</div>}
      {message && <div className="categories-alert info">{message}</div>}

      <section className="categories-section">
        <div className="section-heading-row">
          <h3>Categories</h3>
          <button type="button" className="secondary-btn" onClick={handleApplyRules}>
            Re-apply rules to all
          </button>
        </div>

        <form className="inline-form" onSubmit={handleCreateCategory}>
          <input
            type="text"
            aria-label="New category name"
            placeholder="New category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            aria-label="Category color"
          />
          <button type="submit" className="primary-btn">Add</button>
        </form>

        <ul className="category-list">
          {categories.map((cat) => (
            <li key={cat.id} className="category-item">
              <span className="cat-swatch" style={{ background: cat.color || '#8b90a0' }} />
              <span className="cat-name">{cat.name}</span>
              <span className="cat-meta">{cat.transaction_count || 0} tx · {cat.rule_count || 0} rules</span>
              <button
                type="button"
                className="link-danger"
                onClick={() => handleDeleteCategory(cat.id, cat.name)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="categories-section">
        <h3>Auto-tag Rules</h3>
        <p className="section-hint">If a description contains the pattern (case-insensitive), it gets that category.</p>
        <form className="inline-form" onSubmit={handleAddRule}>
          <select aria-label="Rule category" value={ruleCategoryId} onChange={(e) => setRuleCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            type="text"
            aria-label="Rule keyword"
            placeholder="Keyword e.g. SWIGGY"
            value={rulePattern}
            onChange={(e) => setRulePattern(e.target.value)}
            required
          />
          <button type="submit" className="primary-btn">Add rule</button>
        </form>
        <ul className="rule-list">
          {rules.map((rule) => (
            <li key={rule.id}>
              <code>{rule.pattern}</code>
              <span>→ {rule.category_name}</span>
              <span className="rule-priority">prio {rule.priority}</span>
              <button type="button" className="link-danger" onClick={() => handleDeleteRule(rule.id)}>
                Remove
              </button>
            </li>
          ))}
          {rules.length === 0 && <li className="empty-row">No rules yet</li>}
        </ul>
      </section>

      <section className="categories-section">
        <h3>Monthly Budgets</h3>
        <form className="inline-form" onSubmit={handleSaveBudget}>
          <select aria-label="Budget category" value={budgetCategoryId} onChange={(e) => setBudgetCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            type="number"
            aria-label="Monthly budget amount"
            min="1"
            step="1"
            placeholder="Amount (₹)"
            value={budgetAmount}
            onChange={(e) => setBudgetAmount(e.target.value)}
            required
          />
          <button type="submit" className="primary-btn">Save budget</button>
        </form>

        <div className="budget-list">
          {budgets.map((b) => {
            const pct = b.amount > 0 ? Math.min(100, Math.round((b.spent / b.amount) * 100)) : 0;
            const over = b.spent > b.amount;
            return (
              <div key={b.id} className="budget-card">
                <div className="budget-card-top">
                  <span className="cat-swatch" style={{ background: b.category_color || '#8b90a0' }} />
                  <strong>{b.category_name}</strong>
                  <button type="button" className="link-danger" onClick={() => handleDeleteBudget(b.category_id)}>
                    Remove
                  </button>
                </div>
                <div className="budget-amounts">
                  {formatINR(b.spent)} / {formatINR(b.amount)}
                  <span className={over ? 'over' : ''}>{pct}%</span>
                </div>
                <div className="budget-bar">
                  <div
                    className={`budget-bar-fill${over ? ' over' : pct >= 80 ? ' warn' : ''}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
          {budgets.length === 0 && <p className="empty-row">No budgets set</p>}
        </div>
      </section>

      <section className="categories-section">
        <h3>Recurring Merchants</h3>
        <p className="section-hint">Detected from similar amounts across 3+ months.</p>
        {recurring.length === 0 ? (
          <p className="empty-row">No recurring patterns detected yet</p>
        ) : (
          <ul className="recurring-list">
            {recurring.slice(0, 20).map((r) => (
              <li key={r.description}>
                <span className="recurring-desc">{r.description}</span>
                <span>{formatINR(r.avgAmount)} avg</span>
                <span>{r.occurrences}× / {r.months} mo</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default CategoriesPage;
