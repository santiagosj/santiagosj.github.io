import React from "react";
import Navar from "../Navbar/Navar";
import AppRouter from "../Router/Router";
import { P5Canvas } from '../Canvas/Canvas';
import { LanguageProvider } from "../Language/Language";
import "./AppHolder.scss";

const AppHolder: React.FC = () => {
    return (
        <LanguageProvider>
            <div className="layout">
                <Navar />
                <P5Canvas className='P5Canvas'/>
                <AppRouter />
            </div>
        </LanguageProvider>
    );
};

export default AppHolder;
