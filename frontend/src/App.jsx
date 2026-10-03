import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const EMPTY_FORM = {
  title: '',
  department: '',
  location: '',
  qualification: '',
  salary: '',
  lastDate: '',
  applyLink: ''
};

function isActiveJob(job) {
  const deadline = new Date(job.lastDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return deadline >= today;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function getErrorMessage(error, fallback) {
  return error instanceof TypeError ? fallback : error.message || fallback;
}

function App() {
  const [jobs, setJobs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [adminToken, setAdminToken] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [jobsError, setJobsError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const editorFormRef = useRef(null);

  const requestJobs = async () => {
    const response = await fetch(`${API_URL}/api/jobs`);
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Could not load vacancies.');
    }
    return result.data;
  };

  const fetchJobs = async () => {
    try {
      setJobs(await requestJobs());
      setJobsError('');
    } catch (error) {
      setJobsError(getErrorMessage(error, 'Could not connect to the jobs service.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let current = true;
    requestJobs()
      .then((data) => {
        if (current) setJobs(data);
      })
      .catch((error) => {
        if (current) setJobsError(getErrorMessage(error, 'Could not connect to the jobs service.'));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    if (!showForm) return;

    const frame = window.requestAnimationFrame(() => {
      const firstField = editorFormRef.current?.querySelector('input');
      firstField?.focus({ preventScroll: true });
      editorFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [showForm]);

  const visibleJobs = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    return jobs.filter((job) => {
      const matchesSearch = !query || [
        job.title,
        job.department,
        job.location,
        job.qualification
      ].some((value) => value?.toLocaleLowerCase().includes(query));
      const active = isActiveJob(job);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'open' && active)
        || (statusFilter === 'closed' && !active);
      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchTerm, statusFilter]);

  const openJobs = jobs.filter(isActiveJob).length;
  const departmentCount = new Set(jobs.map((job) => job.department)).size;

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setActionError('');
    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to sign in.');
      }
      setAdminToken(result.token);
      setShowLogin(false);
      setLoginData({ username: '', password: '' });
      setNotice('Signed in to the editor.');
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to sign in.'));
    }
  };

  const handleJobSubmit = async (event) => {
    event.preventDefault();
    setActionError('');
    try {
      const url = editingId ? `${API_URL}/api/jobs/${editingId}` : `${API_URL}/api/jobs`;
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      if (response.status === 401) {
        setAdminToken('');
        throw new Error('Your editor session has expired. Please sign in again.');
      }
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not save this vacancy.');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData(EMPTY_FORM);
      setNotice(editingId ? 'Vacancy updated.' : 'Vacancy published.');
      await fetchJobs();
    } catch (error) {
      setActionError(getErrorMessage(error, 'Could not save this vacancy.'));
    }
  };

  const handleEdit = (job) => {
    setEditingId(job._id);
    setFormData({
      title: job.title,
      department: job.department,
      location: job.location,
      qualification: job.qualification,
      salary: job.salary || '',
      lastDate: new Date(job.lastDate).toISOString().slice(0, 10),
      applyLink: job.applyLink
    });
    setActionError('');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this vacancy from the portal?')) return;
    setActionError('');
    try {
      const response = await fetch(`${API_URL}/api/jobs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const result = await response.json();
      if (response.status === 401) {
        setAdminToken('');
        throw new Error('Your editor session has expired. Please sign in again.');
      }
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not remove this vacancy.');
      }
      setNotice('Vacancy removed.');
      await fetchJobs();
    } catch (error) {
      setActionError(getErrorMessage(error, 'Could not remove this vacancy.'));
    }
  };

  const closeEditor = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setActionError('');
  };

  const signOut = () => {
    setAdminToken('');
    closeEditor();
    setNotice('Signed out of the editor.');
  };

  return (
    <div className="site-shell">
      <div className="site-container">
        <header className="site-header">
          <a className="brand" href="#top" aria-label="Civic Careers home">
            <span className="brand-mark" aria-hidden="true"><span /></span>
            <span className="brand-copy">
              <strong>Civic Careers</strong>
              <small>PUBLIC SERVICE, OPEN TO ALL</small>
            </span>
          </a>
          <nav className="header-nav" aria-label="Main navigation">
            <a href="#vacancies">Vacancies</a>
            <a href="#about">About</a>
          </nav>
          {adminToken ? (
            <button className="header-action" onClick={signOut}>Sign out</button>
          ) : (
            <button
              className="header-action"
              onClick={() => {
                setShowLogin((isVisible) => !isVisible);
                setActionError('');
              }}
            >
              {showLogin ? 'Close sign in' : 'Editor sign in'}
            </button>
          )}
        </header>

        <main id="top">
          <section className="intro-panel" aria-labelledby="page-title">
            <div className="intro-copy">
              <p className="overline"><span className="overline-rule" /> Government opportunities, clearly listed</p>
              <h1 id="page-title">A meaningful career<br />starts with <em>public service.</em></h1>
              <p className="intro-description">
                Find current openings across public departments. Check the details, note the closing date, and apply at the official source.
              </p>
              <a className="intro-link" href="#vacancies">
                Browse current vacancies <span aria-hidden="true">↘</span>
              </a>
            </div>
            <aside className="intro-aside" aria-label="Vacancy summary">
              <p className="aside-kicker">THE LATEST LISTING</p>
              <div className="aside-number">{jobsError ? '—' : String(openJobs).padStart(2, '0')}</div>
              <p className="aside-caption">
                {jobsError
                  ? <>opportunities<br />temporarily unavailable</>
                  : <>open {openJobs === 1 ? 'opportunity' : 'opportunities'}<br />across {departmentCount} {departmentCount === 1 ? 'department' : 'departments'}</>}
              </p>
              <div className="aside-divider" />
              <p className="aside-note">Listings link directly to the recruiting department.</p>
            </aside>
            <div className="intro-index" aria-hidden="true">01 / OPPORTUNITY</div>
          </section>

          {showLogin && !adminToken && (
            <form className="editor-panel" onSubmit={handleLoginSubmit}>
              <div className="editor-heading">
                <div>
                  <p className="section-overline">STAFF ACCESS</p>
                  <h2>Editor sign in</h2>
                </div>
                <button type="button" className="text-button" onClick={() => setShowLogin(false)}>Close</button>
              </div>
              <div className="login-fields">
                <label>
                  Username
                  <input
                    autoComplete="username"
                    value={loginData.username}
                    onChange={(event) => setLoginData({ ...loginData, username: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={loginData.password}
                    onChange={(event) => setLoginData({ ...loginData, password: event.target.value })}
                    required
                  />
                </label>
                <button type="submit" className="button-dark">Continue <span aria-hidden="true">→</span></button>
              </div>
              {actionError && <p className="inline-message error-message" role="alert">{actionError}</p>}
            </form>
          )}

          {adminToken && (
            <section className="editor-panel" aria-label="Vacancy editor">
              {!showForm ? (
                <div className="editor-heading">
                  <div>
                    <p className="section-overline">EDITOR ACCESS</p>
                    <h2>Manage vacancies</h2>
                  </div>
                  <button
                    className="button-dark"
                    onClick={() => {
                      setActionError('');
                      setShowForm(true);
                    }}
                  >
                    Add a vacancy <span aria-hidden="true">+</span>
                  </button>
                </div>
              ) : (
                <form ref={editorFormRef} onSubmit={handleJobSubmit}>
                  <div className="editor-heading">
                    <div>
                      <p className="section-overline">EDITOR ACCESS</p>
                      <h2>{editingId ? 'Edit vacancy' : 'Add a vacancy'}</h2>
                    </div>
                    <button type="button" className="text-button" onClick={closeEditor}>Cancel</button>
                  </div>
                  <div className="job-form-grid">
                    <label className="field-wide">
                      Job title
                      <input value={formData.title} onChange={(event) => setFormData({ ...formData, title: event.target.value })} required />
                    </label>
                    <label>
                      Department
                      <input value={formData.department} onChange={(event) => setFormData({ ...formData, department: event.target.value })} required />
                    </label>
                    <label>
                      Location
                      <input value={formData.location} onChange={(event) => setFormData({ ...formData, location: event.target.value })} required />
                    </label>
                    <label className="field-wide">
                      Qualification
                      <input value={formData.qualification} onChange={(event) => setFormData({ ...formData, qualification: event.target.value })} required />
                    </label>
                    <label>
                      Salary
                      <input value={formData.salary} onChange={(event) => setFormData({ ...formData, salary: event.target.value })} placeholder="Optional" />
                    </label>
                    <label>
                      Closing date
                      <input type="date" value={formData.lastDate} onChange={(event) => setFormData({ ...formData, lastDate: event.target.value })} required />
                    </label>
                    <label className="field-wide">
                      Official application link
                      <input type="url" value={formData.applyLink} onChange={(event) => setFormData({ ...formData, applyLink: event.target.value })} required />
                    </label>
                  </div>
                  <div className="form-footer">
                    <p>Double-check dates and links before publishing.</p>
                    <button type="submit" className="button-dark">{editingId ? 'Save changes' : 'Publish vacancy'} <span aria-hidden="true">→</span></button>
                  </div>
                </form>
              )}
              {actionError && <p className="inline-message error-message" role="alert">{actionError}</p>}
            </section>
          )}

          {notice && <p className="notice-message" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message">×</button></p>}

          <section className="vacancies-section" id="vacancies" aria-labelledby="vacancies-title">
            <div className="section-heading">
              <div>
                <p className="section-overline">OPPORTUNITIES</p>
                <h2 id="vacancies-title">Current vacancies<span className="heading-period">.</span></h2>
              </div>
              <p className="results-count">
                {loading
                  ? 'Checking latest listings'
                  : jobsError
                    ? 'Listings unavailable'
                    : `${visibleJobs.length} ${visibleJobs.length === 1 ? 'listing' : 'listings'}`}
              </p>
            </div>

            <div className="listing-controls">
              <label className="search-field">
                <span className="search-icon" aria-hidden="true" />
                <span className="visually-hidden">Search vacancies</span>
                <input
                  type="search"
                  placeholder="Search title, department or location"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                {searchTerm && <button onClick={() => setSearchTerm('')} aria-label="Clear search">×</button>}
              </label>
              <div className="filter-tabs" role="group" aria-label="Filter vacancies">
                {[
                  ['all', 'All listings'],
                  ['open', 'Open'],
                  ['closed', 'Closed']
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={statusFilter === value ? 'filter-tab active' : 'filter-tab'}
                    onClick={() => setStatusFilter(value)}
                    aria-pressed={statusFilter === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {jobsError ? (
              <div className="empty-panel">
                <p className="section-overline">TEMPORARILY UNAVAILABLE</p>
                <h3>We couldn't load the vacancies.</h3>
                <p>{jobsError}</p>
                <button className="text-button" onClick={fetchJobs}>Try again <span aria-hidden="true">↻</span></button>
              </div>
            ) : loading ? (
              <div className="empty-panel loading-panel" role="status">Loading current vacancies…</div>
            ) : visibleJobs.length === 0 ? (
              <div className="empty-panel">
                <p className="section-overline">NO MATCHES</p>
                <h3>No vacancies found.</h3>
                <p>Try another search or change the listing filter.</p>
                {(searchTerm || statusFilter !== 'all') && (
                  <button className="text-button" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}>Clear filters <span aria-hidden="true">↗</span></button>
                )}
              </div>
            ) : (
              <div className="job-list">
                {visibleJobs.map((job, index) => {
                  const active = isActiveJob(job);
                  return (
                    <article className="job-row" key={job._id}>
                      <div className="job-serial">{String(index + 1).padStart(2, '0')}</div>
                      <div className="job-main">
                        <div className="job-department">{job.department}</div>
                        <h3>{job.title}</h3>
                        <div className="job-meta">
                          <span>{job.location}</span>
                          <span>{job.qualification}</span>
                        </div>
                      </div>
                      <div className="job-deadline">
                        <span className={active ? 'job-status' : 'job-status closed'}>{active ? 'Accepting applications' : 'Applications closed'}</span>
                        <span className="deadline-label">Closing date</span>
                        <strong>{formatDate(job.lastDate)}</strong>
                        {job.salary && <span className="salary-note">{job.salary}</span>}
                      </div>
                      <div className="job-actions">
                        {active ? (
                          <a className="apply-link" href={job.applyLink} target="_blank" rel="noreferrer">
                            Official notice <span aria-hidden="true">↗</span>
                          </a>
                        ) : (
                          <span className="closed-label">Notice closed</span>
                        )}
                        {adminToken && (
                          <div className="admin-actions">
                            <button onClick={() => handleEdit(job)}>Edit</button>
                            <button onClick={() => handleDelete(job._id)}>Remove</button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="source-note" id="about">
            <span className="source-mark" aria-hidden="true">i</span>
            <p><strong>Always verify before applying.</strong> Recruitment details can change. Please confirm eligibility, dates and instructions on the official department website.</p>
          </section>
        </main>

        <footer className="site-footer">
          <span>Civic Careers</span>
          <span>Independent listings · Official links only</span>
        </footer>
      </div>
    </div>
  );
}

export default App;
