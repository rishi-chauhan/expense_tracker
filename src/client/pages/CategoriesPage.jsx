import React, { useCallback, useEffect, useState } from 'react';
import {
  createCategory,
  deleteCategory,
  createCategoryRule,
  deleteCategoryRule,
  applyCategoryRules,
  getBudgets,
  upsertBudget,
  deleteBudget,
} from '../utils/api.js';
import { useCategories, invalidateCategories } from '../hooks/useCategories';
import { useToast } from '../components/ui/Toast';
import { Card, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Amount from '../components/ui/Amount';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import './CategoriesPage.css';

const UNCATEGORISED = '#8b90a0';

function CategoriesPage({ onChanged }) {
  const { categories, rules, loading, error } = useCategories();
  const toast = useToast();
  const [budgets, setBudgets] = useState([]);
  const [budgetsLoading, setBudgetsLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#60a5fa');
  const [ruleCategoryId, setRuleCategoryId] = useState('');
  const [rulePattern, setRulePattern] = useState('');
  const [budgetCategoryId, setBudgetCategoryId] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(null);

  const loadBudgets = useCallback(async () => {
    try {
      const data = await getBudgets();
      setBudgets(data.budgets || []);
    } catch (err) {
      toast.show({ type: 'error', title: 'Budgets not loaded', message: err.message });
    } finally {
      setBudgetsLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadBudgets(); }, [loadBudgets]);

  // Default the selects to the first category once loaded.
  const firstId = categories[0] ? String(categories[0].id) : '';
  const ruleCat = ruleCategoryId || firstId;
  const budgetCat = budgetCategoryId || firstId;

  const run = async (key, fn, success) => {
    setBusy(key);
    try {
      const result = await fn();
      if (success) toast.show({ type: 'success', ...(typeof success === 'function' ? success(result) : success) });
      return result;
    } catch (err) {
      toast.show({ type: 'error', title: 'That didn’t work', message: err.message || 'Try again.' });
      return undefined;
    } finally {
      setBusy(null);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const ok = await run('create', async () => {
      await createCategory({ name, color: newColor });
      await invalidateCategories();
      return true;
    }, { title: 'Category added', message: `${name} is ready to use.` });
    if (ok) setNewName('');
  };

  const handleDeleteCategory = async () => {
    const cat = pendingDelete;
    if (!cat) return;
    await run('delete', async () => {
      await deleteCategory(cat.id);
      await invalidateCategories();
      await loadBudgets();
      if (onChanged) await onChanged();
    }, { title: 'Category deleted', message: `${cat.name} was removed. Its transactions are now uncategorised.` });
    setPendingDelete(null);
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    const pattern = rulePattern.trim();
    if (!ruleCat || !pattern) return;
    const ok = await run('rule', async () => {
      await createCategoryRule({ categoryId: Number(ruleCat), pattern, priority: 10 });
      await invalidateCategories();
      return true;
    }, { title: 'Rule added', message: `Descriptions containing “${pattern}” will be tagged automatically.` });
    if (ok) setRulePattern('');
  };

  const handleDeleteRule = (rule) => run(`rule-${rule.id}`, async () => {
    await deleteCategoryRule(rule.id);
    await invalidateCategories();
  });

  const handleApplyRules = () => run('apply', async () => {
    const result = await applyCategoryRules();
    await invalidateCategories();
    if (onChanged) await onChanged();
    return result;
  }, (result) => ({ title: 'Rules applied', message: `${result.updated} transaction${result.updated === 1 ? '' : 's'} re-tagged.` }));

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    const amount = Number(budgetAmount);
    if (!budgetCat || !Number.isFinite(amount) || amount <= 0) return;
    const ok = await run('budget', async () => {
      await upsertBudget({ categoryId: Number(budgetCat), amount });
      await loadBudgets();
      return true;
    }, { title: 'Budget saved' });
    if (ok) setBudgetAmount('');
  };

  const handleDeleteBudget = (b) => run(`budget-${b.category_id}`, async () => {
    await deleteBudget(b.category_id);
    await loadBudgets();
  });

  if (loading) {
    return (
      <div className="page categories-page" aria-busy="true" aria-label="Loading categories">
        {[0, 1].map(i => <Card key={i}><Skeleton height={20} width="30%" /><div style={{ height: 16 }} /><Skeleton height={120} /></Card>)}
      </div>
    );
  }

  return (
    <div className="page categories-page">
      {error && (
        <Card className="inline-error" role="alert"><span className="inline-error-text">{error}</span></Card>
      )}

      <Card aria-labelledby="cat-heading">
        <CardHeader
          id="cat-heading"
          title="Categories"
          subtitle="Tag merchants so you can see what kind of spending it is"
          actions={<Button size="sm" onClick={handleApplyRules} loading={busy === 'apply'}>Re-apply rules</Button>}
        />
        <form className="inline-form" onSubmit={handleCreateCategory}>
          <Input label="New category name" hideLabel placeholder="New category name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} required className="grow" />
          <label className="color-field" title="Category colour">
            <span className="sr-only">Category color</span>
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} />
          </label>
          <Button type="submit" variant="primary" icon="plus" loading={busy === 'create'}>Add</Button>
        </form>
        <ul className="cat-list">
          {categories.map(cat => (
            <li key={cat.id} className="cat-item">
              <span className="cat-swatch" style={{ background: cat.color || UNCATEGORISED }} aria-hidden="true" />
              <span className="cat-name">{cat.name}</span>
              <span className="cat-meta num">
                {cat.transaction_count || 0} transaction{cat.transaction_count === 1 ? '' : 's'}, {cat.rule_count || 0} rule{cat.rule_count === 1 ? '' : 's'}
              </span>
              <IconButton icon="trash" label={`Delete ${cat.name}`} size={18} onClick={() => setPendingDelete(cat)} />
            </li>
          ))}
        </ul>
      </Card>

      <Card aria-labelledby="rules-heading">
        <CardHeader id="rules-heading" title="Auto-tag rules" subtitle="If a description contains the keyword (any case), it gets that category." />
        <form className="inline-form" onSubmit={handleAddRule}>
          <Select label="Rule category" hideLabel value={ruleCat} onChange={(e) => setRuleCategoryId(e.target.value)}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="Rule keyword" hideLabel placeholder="Keyword, e.g. SWIGGY" value={rulePattern} onChange={(e) => setRulePattern(e.target.value)} maxLength={60} required className="grow" />
          <Button type="submit" variant="primary" loading={busy === 'rule'}>Add rule</Button>
        </form>
        {rules.length === 0 ? (
          <EmptyState icon="categories" title="No rules yet">Add a keyword above to tag matching transactions automatically.</EmptyState>
        ) : (
          <ul className="rule-list">
            {rules.map(rule => (
              <li key={rule.id} className="rule-item">
                <span className="rule-pattern">{rule.pattern}</span>
                <span className="rule-cat">{rule.category_name}</span>
                <IconButton icon="close" label={`Remove rule ${rule.pattern}`} size={16} onClick={() => handleDeleteRule(rule)} disabled={busy === `rule-${rule.id}`} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card aria-labelledby="budgets-heading">
        <CardHeader id="budgets-heading" title="Monthly budgets" subtitle="Get a warning on the Overview at 80% and when you go over." />
        <form className="inline-form" onSubmit={handleSaveBudget}>
          <Select label="Budget category" hideLabel value={budgetCat} onChange={(e) => setBudgetCategoryId(e.target.value)}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="Monthly budget amount" hideLabel type="number" inputMode="numeric" min="1" step="1" placeholder="Amount in ₹" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} required className="grow" />
          <Button type="submit" variant="primary" loading={busy === 'budget'}>Save budget</Button>
        </form>
        {budgetsLoading ? (
          <Skeleton height={60} />
        ) : budgets.length === 0 ? (
          <EmptyState icon="categories" title="No budgets set">Pick a category and a monthly amount above.</EmptyState>
        ) : (
          <ul className="budget-list">
            {budgets.map(b => {
              const pct = b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0;
              const tone = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : '';
              return (
                <li key={b.id} className="budget-item">
                  <div className="budget-top">
                    <span className="cat-swatch" style={{ background: b.category_color || UNCATEGORISED }} aria-hidden="true" />
                    <span className="budget-name">{b.category_name}</span>
                    <span className="budget-amounts">
                      <Amount value={b.spent} whole /> <span className="budget-of">of <Amount value={b.amount} whole /></span>
                    </span>
                    <span className={`budget-pct num${tone ? ` is-${tone}` : ''}`}>{pct}%</span>
                    <IconButton icon="close" label={`Remove budget for ${b.category_name}`} size={16} onClick={() => handleDeleteBudget(b)} />
                  </div>
                  <div className="budget-bar" aria-hidden="true">
                    <div className={`budget-fill${tone ? ` is-${tone}` : ''}`} style={{ width: `${Math.min(100, pct)}%`, background: tone ? undefined : b.category_color || 'var(--accent)' }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete category?"
        message={pendingDelete ? `“${pendingDelete.name}” and its rules and budget will be removed. Its ${pendingDelete.transaction_count || 0} transactions become uncategorised.` : ''}
        confirmLabel="Delete category"
        busy={busy === 'delete'}
        onConfirm={handleDeleteCategory}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export default CategoriesPage;
