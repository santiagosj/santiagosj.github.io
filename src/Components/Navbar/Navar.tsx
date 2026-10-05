import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "./Navbar.scss";

const Navar: React.FC = () => {
    const [menuOpen, setMenuOpen] = useState<boolean>(false);

    const toggleMenu = () => setMenuOpen((v) => !v);
    const closeMenu = () => setMenuOpen(false);

    const getNavClass = ({ isActive }: { isActive: boolean }) =>
        isActive ? "active" : undefined;

    return (
        <nav className="navbar">
            <div className="navbar-left">
                <button
                    type="button"
                    aria-label="Toggle menu"
                    aria-expanded={menuOpen}
                    className={`hamburger${menuOpen ? " open" : ""}`}
                    onClick={toggleMenu}
                >
                    <span className="line" />
                    <span className="line" />
                    <span className="line" />
                </button>

                <div className={`menu${menuOpen ? " open" : ""}`}>
                    <NavLink to="/home" onClick={closeMenu} className={getNavClass}>
                        Home
                    </NavLink>
                    <NavLink to="/about" onClick={closeMenu} className={getNavClass}>
                        About
                    </NavLink>
                    <NavLink to="/projects" onClick={closeMenu} className={getNavClass}>
                        Projects
                    </NavLink>
                    <NavLink to="/posts" onClick={closeMenu} className={getNavClass}>
                        Posts
                    </NavLink>
                </div>
            </div>
        </nav>
    );
};

export default Navar;
